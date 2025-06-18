<?php
// Set appropriate headers
header('Content-Type: application/json');

// Get the file to check from query string
$fileToCheck = isset($_GET['file']) ? $_GET['file'] : 'save-players.php';

// Check if the file exists
$exists = file_exists($fileToCheck);
$readable = is_readable($fileToCheck);
$path = realpath($fileToCheck);

// Return result
echo json_encode([
    'file' => $fileToCheck,
    'exists' => $exists,
    'readable' => $readable,
    'full_path' => $path,
    'server_root' => $_SERVER['DOCUMENT_ROOT'],
    'script_filename' => $_SERVER['SCRIPT_FILENAME'],
    'php_self' => $_SERVER['PHP_SELF'],
    'cwd' => getcwd()
]);
?> 