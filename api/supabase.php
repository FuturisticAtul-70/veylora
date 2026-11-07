<?php
declare(strict_types=1);

final class SupabaseException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        string $message,
        public readonly string $providerCode = ''
    ) {
        parent::__construct($message);
    }
}

final class SupabaseConfigurationException extends RuntimeException
{
}

function supabaseEnvironmentValue(string $name): string
{
    $value = getenv($name);
    if (is_string($value) && trim($value) !== '') {
        return trim($value);
    }

    static $fileValues = null;
    if ($fileValues === null) {
        $fileValues = [];
        $envFile = dirname(__DIR__) . '/.env';
        if (file_exists($envFile)) {
            if (!is_file($envFile) || !is_readable($envFile)) {
                throw new RuntimeException('The project .env path is not a readable file.');
            }
            $lines = file($envFile, FILE_IGNORE_NEW_LINES);
            if ($lines === false) {
                throw new RuntimeException('Could not read the project .env file.');
            }
            foreach ($lines as $index => $line) {
                if ($index === 0) {
                    $line = preg_replace('/^\xEF\xBB\xBF/', '', $line);
                }
                $line = trim($line);
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                if (str_starts_with($line, 'export ')) {
                    $line = substr($line, 7);
                }
                $separator = strpos($line, '=');
                if ($separator === false) {
                    continue;
                }
                $key = trim(substr($line, 0, $separator));
                if (!in_array($key, ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'], true)) {
                    continue;
                }
                $value = trim(substr($line, $separator + 1));
                if (strlen($value) >= 2 && $value[0] === $value[strlen($value) - 1] && in_array($value[0], ['"', "'"], true)) {
                    $value = substr($value, 1, -1);
                } else {
                    $value = preg_replace('/\s+#.*$/', '', $value);
                    $value = trim($value);
                }
                $fileValues[$key] = $value;
            }
        }
    }

    return $fileValues[$name] ?? '';
}

function supabaseConfig(): array
{
    $url = rtrim(supabaseEnvironmentValue('SUPABASE_URL'), '/');
    $key = supabaseEnvironmentValue('SUPABASE_PUBLISHABLE_KEY');
    if ($key === '') {
        $key = supabaseEnvironmentValue('SUPABASE_ANON_KEY');
    }
    $urlParts = parse_url($url);

    if (
        $key === ''
        || !is_array($urlParts)
        || !isset($urlParts['scheme'], $urlParts['host'])
        || !in_array($urlParts['scheme'], ['https', 'http'], true)
        || ($urlParts['scheme'] === 'http' && !in_array($urlParts['host'], ['localhost', '127.0.0.1'], true))
    ) {
        throw new SupabaseConfigurationException('Supabase URL or publishable key is not configured correctly.');
    }

    return [$url, $key];
}

function supabaseRequest(
    string $method,
    string $path,
    ?array $body = null,
    ?string $accessToken = null,
    string $service = 'auth',
    array $extraHeaders = []
): array {
    [$url, $key] = supabaseConfig();
    $base = $service === 'rest' ? '/rest/v1' : '/auth/v1';
    $headers = [
        'apikey: ' . $key,
        'Authorization: Bearer ' . ($accessToken ?? $key),
        'Accept: application/json',
    ];
    foreach ($extraHeaders as $header) {
        $headers[] = $header;
    }
    $options = [
        CURLOPT_URL => $url . $base . $path,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => $headers,
    ];

    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        $options[CURLOPT_HTTPHEADER] = $headers;
        $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    $curl = curl_init();
    if ($curl === false) {
        throw new RuntimeException('Could not initialize the Supabase HTTP client.');
    }
    curl_setopt_array($curl, $options);
    $responseBody = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($responseBody === false) {
        $message = curl_error($curl);
        curl_close($curl);
        throw new RuntimeException('Supabase request failed: ' . $message);
    }
    curl_close($curl);

    $data = $responseBody === '' ? [] : json_decode($responseBody, true);
    if (!is_array($data)) {
        throw new RuntimeException('Supabase returned an invalid response.');
    }
    if ($status < 200 || $status >= 300) {
        $message = $data['msg'] ?? $data['message'] ?? $data['error_description'] ?? $data['error'] ?? 'Supabase request failed.';
        $providerCode = $data['code'] ?? $data['error'] ?? '';
        throw new SupabaseException(
            $status,
            is_string($message) ? $message : 'Supabase request failed.',
            is_string($providerCode) ? $providerCode : ''
        );
    }

    return $data;
}

function clearAuthSession(): void
{
    unset($_SESSION['user'], $_SESSION['access_token'], $_SESSION['refresh_token'], $_SESSION['expires_at']);
    session_regenerate_id(true);
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function normalizedUser(array $user): array
{
    $email = $user['email'] ?? '';
    $metadata = $user['user_metadata'] ?? [];
    $name = is_array($metadata) ? ($metadata['name'] ?? '') : '';
    if (!is_string($name) || trim($name) === '') {
        $name = is_string($email) ? (strstr($email, '@', true) ?: '') : '';
    }

    return [
        'id' => (string)($user['id'] ?? ''),
        'name' => trim($name),
        'email' => is_string($email) ? strtolower($email) : '',
    ];
}

function storeAuthSession(array $authData, bool $regenerateSession = true): array
{
    if (
        !isset($authData['access_token'], $authData['refresh_token'], $authData['user'])
        || !is_string($authData['access_token'])
        || !is_string($authData['refresh_token'])
        || !is_array($authData['user'])
    ) {
        throw new RuntimeException('Supabase did not return a complete authenticated session.');
    }
    $user = normalizedUser($authData['user']);
    if ($user['id'] === '' || $user['email'] === '') {
        throw new RuntimeException('Supabase returned an invalid user profile.');
    }

    if ($regenerateSession) {
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    $_SESSION['access_token'] = $authData['access_token'];
    $_SESSION['refresh_token'] = $authData['refresh_token'];
    $_SESSION['expires_at'] = time() + (int)($authData['expires_in'] ?? 3600);
    $_SESSION['user'] = $user;
    return $user;
}

function authenticatedUser(): ?array
{
    if (!isset($_SESSION['access_token'], $_SESSION['refresh_token'], $_SESSION['user'])) {
        return null;
    }

    try {
        if ((int)($_SESSION['expires_at'] ?? 0) <= time() + 60) {
            $tokens = supabaseRequest('POST', '/token?grant_type=refresh_token', [
                'refresh_token' => $_SESSION['refresh_token'],
            ]);
            storeAuthSession($tokens, false);
        }

        $userData = supabaseRequest('GET', '/user', null, $_SESSION['access_token']);
        if (!isset($userData['id'], $userData['email'])) {
            throw new RuntimeException('Supabase returned an invalid user profile.');
        }
        $_SESSION['user'] = normalizedUser($userData);
        return $_SESSION['user'];
    } catch (SupabaseException $error) {
        if ($error->status === 400 || $error->status === 401) {
            clearAuthSession();
            return null;
        }
        throw $error;
    }
}

function csrfToken(): string
{
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function respond(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
