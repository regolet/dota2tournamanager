<?php
// Set headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle OPTIONS request (for CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check if request method is GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request method'
    ]);
    exit();
}

// Path to registration settings file
$settings_file = __DIR__ . '/data/registration_settings.json';

// Check if settings file exists
if (!file_exists($settings_file)) {
    // Return default settings
    echo json_encode([
        'success' => true,
        'settings' => [
            'isOpen' => false,
            'expiry' => null,
            'createdAt' => null,
            'playerLimit' => 40,
            'enablePlayerLimit' => true
        ]
    ]);
    exit();
}

// Load settings from file
$settings = json_decode(file_get_contents($settings_file), true);

// Return settings
echo json_encode([
    'success' => true,
    'settings' => $settings
]);
?> 