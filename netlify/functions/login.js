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
    
    // Generate session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    console.log('Creating session...');
    
    // Create session in database
    await sql`
      INSERT INTO admin_sessions (id, user_id, role, expires_at)
      VALUES (${sessionId}, ${user.id}, ${user.role}, ${expiresAt.toISOString()})
    `;
    
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
