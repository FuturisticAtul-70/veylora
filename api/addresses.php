<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && $_SERVER['HTTPS'] !== 'off';
session_name('veylora_session');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();
require_once __DIR__ . '/supabase.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
    header('Allow: GET, POST, PUT, DELETE');
    respond(405, ['error' => 'Only GET, POST, PUT, and DELETE requests are accepted.']);
}

$payload = [];
if (in_array($method, ['POST', 'PUT'], true)) {
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength <= 0 || $contentLength > 16384) {
        respond(413, ['error' => 'Request is too large or empty.']);
    }
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody === false ? '' : $rawBody, true);
    if (!is_array($payload)) {
        respond(400, ['error' => 'Invalid request.']);
    }
}

if ($method !== 'GET') {
    $requestToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($requestToken) || !hash_equals(csrfToken(), $requestToken)) {
        respond(403, ['error' => 'Your session expired. Refresh the page and try again.']);
    }
}

$addressId = $_GET['id'] ?? ($payload['id'] ?? '');
if (in_array($method, ['PUT', 'DELETE'], true) && (!is_string($addressId) || !preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i', $addressId))) {
    respond(400, ['error' => 'A valid address ID is required.']);
}

function addressFields(array $input): array
{
    $fields = [
        'full_name' => ['Full name', 100],
        'mobile_number' => ['Mobile number', 20],
        'address_line' => ['House no. and street / area', 300],
        'city' => ['City', 100],
        'state' => ['State', 100],
        'pincode' => ['Pincode', 20],
        'landmark' => ['Landmark', 200],
    ];
    $values = [];
    foreach ($fields as $key => [$label, $maximum]) {
        $value = $input[$key] ?? '';
        if (!is_string($value)) {
            respond(400, ['error' => $label . ' must be text.']);
        }
        $value = trim($value);
        if ($key !== 'landmark' && $value === '') {
            respond(400, ['error' => $label . ' is required.']);
        }
        if (mb_strlen($value) > $maximum) {
            respond(400, ['error' => $label . ' is too long.']);
        }
        $values[$key] = $value === '' ? null : $value;
    }
    if (!preg_match('/^[6-9]\d{9}$/', (string)$values['mobile_number'])) {
        respond(400, ['error' => 'Enter a valid 10-digit mobile number.']);
    }
    if (!preg_match('/^\d{6}$/', (string)$values['pincode'])) {
        respond(400, ['error' => 'Enter a valid 6-digit pincode.']);
    }
    return $values;
}

try {
    supabaseConfig();
    $user = authenticatedUser();
    if ($user === null) {
        respond(401, ['error' => 'Please log in to manage your addresses.']);
    }
    $accessToken = $_SESSION['access_token'];

    if ($method === 'GET') {
        $rows = supabaseRequest(
            'GET',
            '/addresses?select=*&order=created_at.desc',
            null,
            $accessToken,
            'rest'
        );
        respond(200, ['addresses' => $rows, 'csrf' => csrfToken()]);
    }

    if ($method === 'POST') {
        $values = addressFields($payload);
        $values['user_id'] = $user['id'];
        $rows = supabaseRequest(
            'POST',
            '/addresses',
            $values,
            $accessToken,
            'rest',
            ['Prefer: return=representation']
        );
        if (!isset($rows[0]) || !is_array($rows[0])) {
            throw new RuntimeException('Supabase did not return the saved address.');
        }
        respond(201, ['address' => $rows[0], 'csrf' => csrfToken()]);
    }

    $filter = '?id=eq.' . rawurlencode($addressId) . '&select=*';
    if ($method === 'PUT') {
        $values = addressFields($payload);
        $rows = supabaseRequest(
            'PATCH',
            '/addresses' . $filter,
            $values,
            $accessToken,
            'rest',
            ['Prefer: return=representation']
        );
        if (!isset($rows[0]) || !is_array($rows[0])) {
            respond(404, ['error' => 'Address not found.']);
        }
        respond(200, ['address' => $rows[0], 'csrf' => csrfToken()]);
    }

    $rows = supabaseRequest(
        'DELETE',
        '/addresses' . $filter,
        null,
        $accessToken,
        'rest',
        ['Prefer: return=representation']
    );
    if (!$rows) {
        respond(404, ['error' => 'Address not found.']);
    }
    respond(200, ['deleted' => true, 'csrf' => csrfToken()]);
} catch (SupabaseException $error) {
    if ($error->status === 401) {
        clearAuthSession();
        respond(401, ['error' => 'Your session expired. Please log in again.']);
    }
    if ($error->status === 400 || $error->status === 422) {
        respond(400, ['error' => 'The address data was rejected. Check the fields and try again.']);
    }
    if ($error->status === 403) {
        respond(403, ['error' => 'You are not allowed to manage this address.']);
    }
    if ($error->status === 404 || $error->providerCode === 'PGRST205') {
        error_log('Veylora Supabase addresses table is missing or unavailable: ' . $error->getMessage());
        respond(503, ['error' => 'Address storage is not available in Supabase yet. Run database/schema.sql in the Supabase SQL Editor, then try again.']);
    }
    if ($error->status === 406) {
        respond(503, ['error' => 'Supabase could not return the saved address. Please retry.']);
    }
    if ($error->status === 409) {
        respond(400, ['error' => 'The address could not be saved. Check the fields and try again.']);
    }
    error_log('Veylora Supabase address error (HTTP ' . $error->status . '): ' . $error->getMessage());
    respond(503, ['error' => 'The address service is unavailable. Please try again later.']);
} catch (Throwable $error) {
    error_log('Veylora Supabase address error: ' . $error->getMessage());
    respond(503, ['error' => 'The address service is unavailable. Check your Supabase configuration and try again.']);
}
