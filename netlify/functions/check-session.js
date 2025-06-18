// Session validation function for admin authentication
import { validateSession } from './database.js';

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
    console.log('Check session request received');
    
    // Get session ID from headers
    const sessionId = event.headers['x-session-id'];
    
    if (!sessionId) {
      console.log('No session ID provided');
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

    console.log('Validating session:', sessionId);
    
    // Validate session using database
    const isValid = await validateSession(sessionId);
    
    if (isValid) {
      console.log('Session is valid');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Session is valid'
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
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
}; 