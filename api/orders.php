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
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    respond(405, ['error' => 'Only GET and POST requests are accepted.']);
}

$payload = [];
if ($method === 'POST') {
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength <= 0 || $contentLength > 32768) {
        respond(413, ['error' => 'Request is too large or empty.']);
    }
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody === false ? '' : $rawBody, true);
    if (!is_array($payload)) {
        respond(400, ['error' => 'Invalid request.']);
    }
    $requestToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($requestToken) || !hash_equals(csrfToken(), $requestToken)) {
        respond(403, ['error' => 'Your session expired. Refresh the page and try again.']);
    }
}

function orderItems(array $input): array
{
    if (!isset($input['items']) || !is_array($input['items']) || !$input['items'] || count($input['items']) > 50) {
        respond(400, ['error' => 'An order must contain between 1 and 50 items.']);
    }
    $items = [];
    foreach ($input['items'] as $item) {
        if (!is_array($item)) {
            respond(400, ['error' => 'Order item data is invalid.']);
        }
        $name = $item['name'] ?? null;
        $type = $item['type'] ?? null;
        $size = $item['size'] ?? null;
        $price = $item['price'] ?? null;
        $quantity = $item['qty'] ?? null;
        if (
            !is_string($name) || trim($name) === '' || mb_strlen($name) > 150
            || !is_string($type) || trim($type) === '' || mb_strlen($type) > 100
            || !is_string($size) || trim($size) === '' || mb_strlen($size) > 20
            || (!is_int($price) && !(is_string($price) && ctype_digit($price)))
            || (!is_int($quantity) && !(is_string($quantity) && ctype_digit($quantity)))
        ) {
            respond(400, ['error' => 'Order item name, product type, size, price, or quantity is invalid.']);
        }
        $price = (int)$price;
        $quantity = (int)$quantity;
        if ($price < 1 || $price > 10000000 || $quantity < 1 || $quantity > 99) {
            respond(400, ['error' => 'Order item price or quantity is outside the allowed range.']);
        }
        $items[] = [
            'name' => trim($name),
            'type' => trim($type),
            'size' => trim($size),
            'price' => $price,
            'qty' => $quantity,
        ];
    }
    return $items;
}

try {
    supabaseConfig();
    $user = authenticatedUser();
    if ($user === null) {
        respond(401, ['error' => 'Please log in to view or place orders.']);
    }
    $accessToken = $_SESSION['access_token'];

    if ($method === 'GET') {
        $rows = supabaseRequest(
            'GET',
            '/orders?select=*&order=created_at.desc&limit=100',
            null,
            $accessToken,
            'rest'
        );
        respond(200, ['orders' => $rows, 'csrf' => csrfToken()]);
    }

    $addressId = $payload['address_id'] ?? null;
    if (
        !is_string($addressId)
        || !preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i', $addressId)
    ) {
        respond(400, ['error' => 'A valid delivery address is required.']);
    }
    $ownedAddresses = supabaseRequest(
        'GET',
        '/addresses?id=eq.' . rawurlencode($addressId) . '&select=id&limit=1',
        null,
        $accessToken,
        'rest'
    );
    if (!$ownedAddresses) {
        respond(400, ['error' => 'The selected delivery address is not available. Choose an address and try again.']);
    }

    $items = orderItems($payload);
    $total = array_sum(array_map(static fn(array $item): int => $item['price'] * $item['qty'], $items));
    if ($total < 1 || $total > 100000000) {
        respond(400, ['error' => 'The order total is outside the allowed range.']);
    }

    $paymentMethod = $payload['payment_method'] ?? null;
    $utr = $payload['utr'] ?? null;
    if ($paymentMethod === 'UPI') {
        if (!is_string($utr) || !preg_match('/^[0-9]{12}$/', $utr)) {
            respond(400, ['error' => 'Enter a valid 12-digit UPI reference number.']);
        }
        $paymentStatus = 'Awaiting verification';
    } elseif ($paymentMethod === 'COD') {
        $utr = null;
        $paymentStatus = 'Pay on delivery';
    } else {
        respond(400, ['error' => 'Select a valid payment method.']);
    }

    $rows = supabaseRequest(
        'POST',
        '/orders',
        [
            'order_number' => 'VEY' . date('ymd') . strtoupper(bin2hex(random_bytes(4))),
            'user_id' => $user['id'],
            'address_id' => $addressId,
            'items' => $items,
            'total_price' => $total,
            'payment_method' => $paymentMethod,
            'payment_status' => $paymentStatus,
            'utr' => $utr,
            'status' => 'Placed',
        ],
        $accessToken,
        'rest',
        ['Prefer: return=representation']
    );
    if (!isset($rows[0]) || !is_array($rows[0])) {
        throw new RuntimeException('Supabase did not return the saved order.');
    }
    respond(201, ['order' => $rows[0], 'csrf' => csrfToken()]);
} catch (SupabaseException $error) {
    if ($error->status === 401) {
        clearAuthSession();
        respond(401, ['error' => 'Your session expired. Please log in again.']);
    }
    if ($error->status === 400 || $error->status === 422) {
        respond(400, ['error' => 'The order data was rejected. Check your cart and payment details, then try again.']);
    }
    if ($error->status === 403) {
        respond(403, ['error' => 'You are not allowed to access this order.']);
    }
    if (
        $error->providerCode === 'PGRST205'
        && (str_contains($error->getMessage(), 'orders') || str_contains($error->getMessage(), 'public.orders'))
    ) {
        error_log('Veylora Supabase orders table is missing or unavailable: ' . $error->getMessage());
        respond(503, ['error' => 'Supabase PostgREST cannot see public.orders. Verify the migration succeeded in the same project as SUPABASE_URL, and that its final SQL check shows a table and true permissions. Then reload the Supabase API schema cache and retry.']);
    }
    if (
        $error->providerCode === 'PGRST205'
        && (str_contains($error->getMessage(), 'addresses') || str_contains($error->getMessage(), 'public.addresses'))
    ) {
        error_log('Veylora Supabase addresses table is missing or unavailable while saving an order: ' . $error->getMessage());
        respond(503, ['error' => 'The delivery-address table is missing from the Supabase API. Run database/schema.sql in the Supabase SQL Editor, then try again.']);
    }
    error_log('Veylora Supabase order error (HTTP ' . $error->status . '): ' . $error->getMessage());
    respond(503, ['error' => 'The order service is unavailable. Please try again later.']);
} catch (Throwable $error) {
    error_log('Veylora Supabase order error: ' . $error->getMessage());
    respond(503, ['error' => 'The order service is unavailable. Check your Supabase configuration and try again.']);
}
