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
    
    
    // Get session ID from headers
    const sessionId = event.headers['x-session-id'];
    
    if (!sessionId) {
      
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

    
    
    // Validate session using database
    const sessionData = await validateSession(sessionId);
    
    if (sessionData.valid) {
      
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
