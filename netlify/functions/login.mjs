// Admin login function
import { sql } from './database.mjs';
import bcrypt from 'bcrypt';

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
    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid request format'
        })
      };
    }
    
    const { username, password } = requestBody;
    
    // Basic validation
    if (!username || !password) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Username and password are required'
        })
      };
    }
    
    // Authenticate user
    
    // Get user from database
    const users = await sql`
      SELECT id, username, password_hash, role, full_name, email, is_active
      FROM admin_users 
      WHERE username = ${username} AND is_active = true
    `;
    
    if (users.length === 0) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid username or password'
        })
      };
    }
    
    const user = users[0];
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid username or password'
        })
      };
    }
    
    // Generate session with proper timezone handling
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Ensure we're working with UTC for consistency
    const expiresAtUTC = new Date(expiresAt.toISOString());
    
    // Create session in database
    await sql`
      INSERT INTO admin_sessions (id, user_id, role, expires_at)
      VALUES (${sessionId}, ${user.id}, ${user.role}, ${expiresAtUTC.toISOString()})
    `;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
              body: JSON.stringify({
          success: true,
          sessionId: sessionId,
          expiresAt: expiresAtUTC.toISOString(),
          user: {
            username: user.username,
            role: user.role,
            fullName: user.full_name,
            email: user.email
          },
          message: 'Login successful'
        })
    };

  } catch (error) {
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
