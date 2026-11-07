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

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    try {
        supabaseConfig();
        respond(200, ['user' => authenticatedUser(), 'csrf' => csrfToken()]);
    } catch (SupabaseConfigurationException $error) {
        error_log('Veylora Supabase configuration error: ' . $error->getMessage());
        respond(503, ['error' => 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) to the project .env file, then restart PHP.']);
    } catch (Throwable $error) {
        error_log('Veylora Supabase session error: ' . $error->getMessage());
        respond(503, ['error' => 'The account service is unavailable. Check the PHP server and Supabase project connectivity.']);
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['error' => 'Only GET and POST requests are accepted.']);
}

$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength <= 0 || $contentLength > 16384) {
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

$action = $payload['action'] ?? '';
if (!is_string($action)) {
    respond(400, ['error' => 'Invalid action.']);
}

if ($action === 'logout') {
    $logoutWarning = null;
    if (isset($_SESSION['access_token']) && is_string($_SESSION['access_token'])) {
        try {
            supabaseRequest('POST', '/logout', null, $_SESSION['access_token']);
        } catch (Throwable $error) {
            error_log('Veylora Supabase logout error: ' . $error->getMessage());
            $logoutWarning = 'You have been signed out on this device, but Supabase could not revoke the remote token.';
        }
    }
    clearAuthSession();
    $response = ['user' => null, 'csrf' => $_SESSION['csrf_token']];
    if ($logoutWarning !== null) {
        $response['warning'] = $logoutWarning;
    }
    respond(200, $response);
}

if ($action !== 'signup' && $action !== 'login') {
    respond(400, ['error' => 'Unknown authentication action.']);
}

$email = $payload['email'] ?? null;
$password = $payload['password'] ?? null;
if (!is_string($email) || !is_string($password)) {
    respond(400, ['error' => 'Email and password are required.']);
}
$email = strtolower(trim($email));
if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    respond(400, ['error' => 'Enter a valid email address.']);
}
if ($password === '') {
    respond(400, ['error' => 'Enter a password.']);
}
if (strlen($password) > 72) {
    respond(400, ['error' => 'Password must not exceed 72 bytes.']);
}

if ($action === 'signup') {
    $name = $payload['name'] ?? null;
    if (!is_string($name)) {
        respond(400, ['error' => 'Your full name is required.']);
    }
    $name = trim($name);
    if (mb_strlen($name) < 2 || mb_strlen($name) > 100 || preg_match('/[\x00-\x1F\x7F]/u', $name)) {
        respond(400, ['error' => 'Enter a valid full name (2 to 100 characters).']);
    }
    if (
        strlen($password) < 8
        || !preg_match('/[A-Za-z]/', $password)
        || !preg_match('/\d/', $password)
    ) {
        respond(400, ['error' => 'Password needs at least 8 characters with letters and numbers.']);
    }
}

try {
    if ($action === 'signup') {
        $authData = supabaseRequest('POST', '/signup', [
            'email' => $email,
            'password' => $password,
            'data' => ['name' => $name],
        ]);
        if (isset($authData['access_token'], $authData['refresh_token'], $authData['user']) && is_array($authData['user'])) {
            $user = storeAuthSession($authData);
            respond(201, ['user' => $user, 'csrf' => $_SESSION['csrf_token']]);
        }

        respond(202, [
            'user' => null,
            'confirmation_required' => true,
            'message' => 'Account created. Check your email to confirm your address, then log in.',
            'csrf' => csrfToken(),
        ]);
    }

    $authData = supabaseRequest('POST', '/token?grant_type=password', [
        'email' => $email,
        'password' => $password,
    ]);
    $user = storeAuthSession($authData);
    respond(200, ['user' => $user, 'csrf' => $_SESSION['csrf_token']]);
} catch (SupabaseException $error) {
    if (
        $action === 'signup'
        && ($error->status === 400 || $error->status === 422)
        && (stripos($error->getMessage(), 'already registered') !== false
            || stripos($error->getMessage(), 'already been registered') !== false)
    ) {
        respond(409, [
            'code' => 'email_taken',
            'error' => 'This email is already registered. Log in instead.',
        ]);
    }
    if ($action === 'login' && in_array($error->status, [400, 401, 422], true)) {
        respond(401, [
            'code' => 'invalid_credentials',
            'error' => 'Email or password is incorrect.',
        ]);
    }
    error_log('Veylora Supabase authentication error (HTTP ' . $error->status . '): ' . $error->getMessage());
    respond(503, ['error' => 'The account service is unavailable. Please try again later.']);
} catch (SupabaseConfigurationException $error) {
    error_log('Veylora Supabase configuration error: ' . $error->getMessage());
    respond(503, ['error' => 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) to the project .env file, then restart PHP.']);
} catch (Throwable $error) {
    error_log('Veylora Supabase authentication error: ' . $error->getMessage());
    respond(503, ['error' => 'The account service is unavailable. Check your Supabase configuration and try again.']);
}
