// Session validation function for admin authentication
import { validateSession } from './database.mjs';

export const handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    };
  }

  try {
    console.log('Check-session function called:', {
      method: event.httpMethod,
      headers: event.headers,
      timestamp: new Date().toISOString()
    });
    
    // Get session ID from headers
    const sessionId = event.headers['x-session-id'];
    
    if (!sessionId) {
      console.log('No session ID provided in headers');
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'No session ID provided'
        })
      };
    }

    console.log('Validating session ID:', sessionId);
    
    // Validate session using database
    const sessionData = await validateSession(sessionId);
    
    console.log('Session validation result:', {
      valid: sessionData.valid,
      userId: sessionData.userId,
      username: sessionData.username,
      role: sessionData.role
    });
    
    if (sessionData.valid) {
      console.log('Session is valid, returning success response');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Session is valid',
          user: {
            userId: sessionData.userId,
            username: sessionData.username,
            role: sessionData.role,
            fullName: sessionData.fullName
          }
        })
      };
    } else {
      console.log('Session is invalid or expired');
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Session is invalid or expired'
        })
      };
    }

  } catch (error) {
    console.error('Error checking session:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    };
  }
}; 
