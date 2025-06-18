<?php
// Set headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle OPTIONS request (for CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check if request method is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request method'
    ]);
    exit();
}

// Get JSON data from request body
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

// Check if JSON data is valid
if ($data === null) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid JSON data'
    ]);
    exit();
}

// Get action and settings from request data
$action = $data['action'] ?? '';
$settings = $data['settings'] ?? [];

// Check if action is valid
if (!in_array($action, ['create', 'close', 'update'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    exit();
}

// Check if settings are valid
if (empty($settings)) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid settings'
    ]);
    exit();
}

// Path to registration settings file
$settings_file = __DIR__ . '/data/registration_settings.json';

// Make sure data directory exists
if (!is_dir(__DIR__ . '/data')) {
    mkdir(__DIR__ . '/data', 0755, true);
}

// Save settings to file
file_put_contents($settings_file, json_encode($settings, JSON_PRETTY_PRINT));

// Return success response
echo json_encode([
    'success' => true,
    'message' => 'Registration settings saved successfully',
    'settings' => $settings
]);
?> 