// Admin login function
import { createSession, authenticateUser } from './database.js';

export const handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    
    
    const { username, password } = JSON.parse(event.body);
    
    console.log('Login attempt for username:', username);
    
    // Authenticate user using database
    const authResult = await authenticateUser(username, password);
    console.log('Authentication result:', authResult);
    
    if (authResult.success) {
      try {
        // Generate session ID
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Set session expiration (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        console.log('Creating session for user:', authResult.user.id, 'Role:', authResult.user.role);
        
        // Create session in database
        await createSession(sessionId, authResult.user.id, authResult.user.role, expiresAt.toISOString());
        
        console.log('Session created successfully:', sessionId);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            sessionId: sessionId,
            expiresAt: expiresAt.toISOString(),
            user: {
              username: authResult.user.username,
              role: authResult.user.role,
              fullName: authResult.user.fullName,
              email: authResult.user.email
            },
            message: 'Login successful'
          })
        };
      } catch (sessionError) {
        console.error('Session creation error:', sessionError);
        throw new Error('Session creation failed: ' + sessionError.message);
      }
    } else {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: authResult.message || 'Invalid username or password'
        })
      };
    }

  } catch (error) {
    console.error('Login error:', error);
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
        details: error.message,
        stack: error.stack
      })
    };
  }
}; 
