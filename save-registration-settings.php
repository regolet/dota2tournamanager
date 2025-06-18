<?php
// Set appropriate headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Only POST requests are allowed']);
    exit;
}

// Get the raw POST data
$jsonData = file_get_contents('php://input');

// Decode the JSON data
$data = json_decode($jsonData, true);

// Validate the data
if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Invalid JSON data received']);
    exit;
}

// Define the file path
$filePath = __DIR__ . '/registration-settings.json';

// Check if this is a delete/reset action
$action = isset($data['action']) ? $data['action'] : 'update';

if ($action === 'delete') {
    // Create a default/empty registration settings
    $data = [
        'id' => null,
        'expiry' => null,
        'status' => null,
        'isOpen' => false,
        'createdAt' => null
    ];
}

try {
    // Write the JSON data to the file
    $result = file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT));
    
    if ($result === false) {
        echo json_encode(['success' => false, 'message' => 'Failed to write to file']);
        exit;
    }
    
    // Return success response with appropriate message
    $message = ($action === 'delete') ? 'Registration settings reset successfully' : 'Registration settings saved successfully';
    
    echo json_encode([
        'success' => true, 
        'message' => $message,
        'registration' => $data
    ]);
    
} catch (Exception $e) {
    // Handle any exceptions
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?>
