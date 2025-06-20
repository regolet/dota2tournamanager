// Login test function for debugging authentication
import { neon } from '@netlify/neon';
import bcrypt from 'bcrypt';

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

  try {
    console.log('Login test starting...');
    
    // Test with hardcoded admin credentials
    const testUsername = 'admin';
    const testPassword = 'Admin123!';
    
    console.log('Testing login with:', testUsername);
    
    // Get user from database
    const users = await sql`
      SELECT id, username, password_hash, role, full_name, email, is_active
      FROM admin_users 
      WHERE username = ${testUsername} AND is_active = true
    `;
    
    console.log(`Database query completed. Found ${users.length} users.`);
    
    if (users.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          test: 'user_lookup',
          result: 'User not found or inactive',
          debug: {
            username: testUsername,
            usersFound: users.length
          }
        })
      };
    }
    
    const user = users[0];
    console.log('User found:', user.username, 'Role:', user.role);
    console.log('Password hash exists:', !!user.password_hash);
    console.log('Password hash length:', user.password_hash ? user.password_hash.length : 0);
    
    // Test password verification
    const isPasswordValid = await bcrypt.compare(testPassword, user.password_hash);
    console.log('Password verification result:', isPasswordValid);
    
    // Also test with bcrypt.hash to see if we can create a working hash
    const testHash = await bcrypt.hash(testPassword, 12);
    const testHashVerify = await bcrypt.compare(testPassword, testHash);
    console.log('Test hash verification:', testHashVerify);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        test: 'password_verification',
        result: {
          userFound: true,
          username: user.username,
          role: user.role,
          isActive: user.is_active,
          passwordHashExists: !!user.password_hash,
          passwordHashLength: user.password_hash ? user.password_hash.length : 0,
          passwordVerificationResult: isPasswordValid,
          testHashVerification: testHashVerify,
          bcryptWorking: testHashVerify
        }
      })
    };

  } catch (error) {
    console.error('Login test error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Test failed',
        details: error.message,
        stack: error.stack
      })
    };
  }
}; 