// Change password API for admin users
import { authenticateUser, updateAdminUser, validateSession } from './database.mjs';
import { validatePasswordStrength } from './password-utils.mjs';

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST method
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed'
      })
    };
  }

  try {
    // Validate session
    const sessionId = event.headers['x-session-id'];
    if (!sessionId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'No session provided'
        })
      };
    }

    const session = await validateSession(sessionId);
    if (!session.valid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid or expired session'
        })
      };
    }

    // Parse request body
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid JSON in request body'
        })
      };
    }

    const { currentPassword, newPassword, confirmPassword } = requestData;

    // Input validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Current password, new password, and confirmation are required'
        })
      };
    }

    if (newPassword !== confirmPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'New password and confirmation do not match'
        })
      };
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'New password does not meet security requirements',
          requirements: passwordValidation.messages
        })
      };
    }

    // Verify current password
    const authResult = await authenticateUser(session.user.username, currentPassword);
    if (!authResult.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Current password is incorrect'
        })
      };
    }

    // Prevent using the same password
    if (currentPassword === newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'New password must be different from current password'
        })
      };
    }

    // Update password
    const updateResult = await updateAdminUser(session.user.id, {
      password: newPassword
    });

    if (!updateResult.success) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: updateResult.message || 'Failed to update password'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Password changed successfully'
      })
    };

  } catch (error) {
    console.error('Change password API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error'
      })
    };
  }
}; 