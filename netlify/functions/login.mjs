// Admin login function - Simplified for debugging
import { neon } from '@netlify/neon';
import bcrypt from 'bcrypt';

// Initialize database connection
const sql = neon(process.env.DATABASE_URL);

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
    console.log('Login function starting...');
    
    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
      console.log('Request body parsed successfully');
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
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
    console.log('Login attempt for username:', username);
    
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
    console.log('Attempting database authentication...');
    
    // Get user from database
    const users = await sql`
      SELECT id, username, password_hash, role, full_name, email, is_active
      FROM admin_users 
      WHERE username = ${username} AND is_active = true
    `;
    
    console.log(`Database query completed. Found ${users.length} users.`);
    
    if (users.length === 0) {
      console.log('User not found or inactive');
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
    console.log('User found, verifying password...');
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    console.log('Password verification result:', isPasswordValid);
    
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
    
    console.log('Creating session...', {
      sessionId,
      userId: user.id,
      role: user.role,
      expiresAt: expiresAt.toISOString()
    });
    
    // Create session in database
    await sql`
      INSERT INTO admin_sessions (id, user_id, role, expires_at)
      VALUES (${sessionId}, ${user.id}, ${user.role}, ${expiresAtUTC.toISOString()})
    `;
    
    console.log('Session created successfully:', sessionId);
    
    // Add small delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify session was created properly by checking it immediately
    try {
      const verifySession = await sql`
        SELECT s.id, s.user_id, s.role, s.expires_at, u.username, u.full_name, u.is_active
        FROM admin_sessions s
        JOIN admin_users u ON s.user_id = u.id
        WHERE s.id = ${sessionId} AND u.is_active = true
      `;
      
      if (verifySession.length > 0) {
        const session = verifySession[0];
        const now = new Date();
        const sessionExpires = new Date(session.expires_at);
        console.log('Session verification successful:', {
          sessionId: session.id,
          username: session.username,
          expiresAt: sessionExpires.toISOString(),
          currentTime: now.toISOString(),
          isValid: sessionExpires > now
        });
      } else {
        console.error('Session verification failed - session not found in database');
      }
    } catch (verifyError) {
      console.error('Error verifying session after creation:', verifyError);
    }
    
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
        details: error.message
      })
    };
  }
}; 
