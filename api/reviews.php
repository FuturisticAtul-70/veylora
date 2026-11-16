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
    if ($contentLength <= 0 || $contentLength > 8192) {
        respond(413, ['error' => 'Review request is too large or empty.']);
    }
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody === false ? '' : $rawBody, true);
    if (!is_array($payload)) {
        respond(400, ['error' => 'Invalid review request.']);
    }
    $requestToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($requestToken) || !hash_equals(csrfToken(), $requestToken)) {
        respond(403, ['error' => 'Your session expired. Refresh the page and try again.']);
    }
}

function reviewProductId(mixed $value): int
{
    if ((!is_int($value) && !(is_string($value) && ctype_digit($value))) || (int)$value < 1) {
        respond(400, ['error' => 'A valid product is required for a review.']);
    }
    return (int)$value;
}

try {
    supabaseConfig();
    $productId = reviewProductId($method === 'GET' ? ($_GET['product_id'] ?? null) : ($payload['product_id'] ?? null));

    if ($method === 'GET') {
        $rows = supabaseRequest(
            'GET',
            '/reviews?product_id=eq.' . $productId . '&select=id,product_id,reviewer_name,rating,review_text,created_at&order=created_at.desc&limit=100',
            null,
            null,
            'rest'
        );
        $myReview = null;
        if (isset($_SESSION['access_token'], $_SESSION['refresh_token'], $_SESSION['user'])) {
            $user = authenticatedUser();
            if ($user !== null) {
                $mine = supabaseRequest(
                    'GET',
                    '/reviews?product_id=eq.' . $productId . '&user_id=eq.' . rawurlencode($user['id']) . '&select=id,product_id,rating,review_text&limit=1',
                    null,
                    $_SESSION['access_token'],
                    'rest'
                );
                $myReview = $mine[0] ?? null;
            }
        }
        respond(200, ['reviews' => $rows, 'my_review' => $myReview]);
    }

    $user = authenticatedUser();
    if ($user === null) {
        respond(401, ['error' => 'Please log in to leave a review.']);
    }
    $rating = $payload['rating'] ?? null;
    if ((!is_int($rating) && !(is_string($rating) && ctype_digit($rating))) || (int)$rating < 1 || (int)$rating > 5) {
        respond(400, ['error' => 'Choose a star rating from 1 to 5.']);
    }
    $text = $payload['review_text'] ?? '';
    if (!is_string($text)) {
        respond(400, ['error' => 'Review text must be plain text.']);
    }
    $text = trim($text);
    if (mb_strlen($text) > 1000) {
        respond(400, ['error' => 'Reviews must be 1000 characters or fewer.']);
    }

    $reviewValues = [
        'reviewer_name' => $user['name'],
        'rating' => (int)$rating,
        'review_text' => $text,
    ];
    $existing = supabaseRequest(
        'GET',
        '/reviews?product_id=eq.' . $productId . '&user_id=eq.' . rawurlencode($user['id']) . '&select=id&limit=1',
        null,
        $_SESSION['access_token'],
        'rest'
    );
    if (isset($existing[0]['id']) && is_string($existing[0]['id'])) {
        $rows = supabaseRequest(
            'PATCH',
            '/reviews?id=eq.' . rawurlencode($existing[0]['id']) . '&select=id,product_id,reviewer_name,rating,review_text,created_at',
            $reviewValues,
            $_SESSION['access_token'],
            'rest',
            ['Prefer: return=representation']
        );
    } else {
        $rows = supabaseRequest(
            'POST',
            '/reviews?select=id,product_id,reviewer_name,rating,review_text,created_at',
            $reviewValues + ['product_id' => $productId, 'user_id' => $user['id']],
            $_SESSION['access_token'],
            'rest',
            ['Prefer: return=representation']
        );
    }
    if (!isset($rows[0]) || !is_array($rows[0])) {
        throw new RuntimeException('Supabase did not return the saved review.');
    }
    respond(200, ['review' => $rows[0], 'csrf' => csrfToken()]);
} catch (SupabaseException $error) {
    if ($error->status === 401) {
        clearAuthSession();
        respond(401, ['error' => 'Your session expired. Please log in again.']);
    }
    if ($error->providerCode === 'PGRST205' && str_contains($error->getMessage(), 'reviews')) {
        error_log('Veylora Supabase reviews table is missing or unavailable: ' . $error->getMessage());
        respond(503, ['error' => 'Product reviews are not set up in Supabase yet. Run database/reviews.sql for an existing project or database/schema.sql for a new project.']);
    }
    if ($error->status === 400 || $error->status === 422) {
        respond(400, ['error' => 'Supabase rejected the review. Check the rating and review length, then try again.']);
    }
    if ($error->status === 403) {
        respond(403, ['error' => 'You are not allowed to submit this review.']);
    }
    error_log('Veylora Supabase review error (HTTP ' . $error->status . '): ' . $error->getMessage());
    respond(503, ['error' => 'The review service is unavailable. Please try again later.']);
} catch (Throwable $error) {
    error_log('Veylora Supabase review error: ' . $error->getMessage());
    respond(503, ['error' => 'The review service is unavailable. Check your Supabase configuration and try again.']);
}
