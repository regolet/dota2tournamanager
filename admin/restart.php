<?php
// Restart script - clears session and redirects to login
session_start();

// Clear all session data
$_SESSION = array();

// Delete the session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Destroy the session
session_destroy();

// Optional: Clear any cached files
clearstatcache();

// Redirect to login page
header("Location: login.php?restart=true");
exit();
?> 