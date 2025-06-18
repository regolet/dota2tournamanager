<?php
// This script redirects any direct access attempts to the login page
// It can be included at the top of HTML files that should not be accessed directly

// Start the session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Function to check if user is logged in
function is_admin_logged_in() {
    return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

// Check if user is logged in
if (!is_admin_logged_in()) {
    // Not logged in, redirect to login page
    header("Location: login.php");
    exit();
}
?> 