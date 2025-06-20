// Admin login function
import { createSession, authenticateUser } from './database.js';
import { 
  validateUsername, 
  validateString, 
  checkRateLimit, 
  sanitizeForLogging 
} from './validation-utils.js';

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
    // Enhanced rate limiting for login attempts
    const clientIP = event.headers['x-forwarded-for'] || event.headers['cf-connecting-ip'] || 'unknown';
    const rateLimit = checkRateLimit(`login-${clientIP}`, 5, 900000); // 5 attempts per 15 minutes
    
    if (!rateLimit.allowed) {
      console.warn(`Login rate limit exceeded for IP: ${clientIP}`);
      return {
        statusCode: 429,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Retry-After': rateLimit.retryAfter.toString()
        },
        body: JSON.stringify({
          success: false,
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter
        })
      };
    }
    
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.warn('Invalid JSON in login request from IP:', clientIP);
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
    
    // Log sanitized request (username only, no password)
    console.log('Login attempt:', {
      ip: clientIP,
      username: username || '[missing]',
      timestamp: new Date().toISOString()
    });
    
    // Validate input
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
    
    // Validate username format
    const usernameValidation = validateUsername(username, true);
    if (!usernameValidation.isValid) {
      console.warn(`Invalid username format in login attempt from IP: ${clientIP}`, usernameValidation.errors);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid username format'
        })
      };
    }
    
    // Validate password (basic checks, not strength since it's existing password)
    const passwordValidation = validateString(password, {
      required: true,
      minLength: 1,
      maxLength: 128,
      fieldName: 'Password'
    });
    if (!passwordValidation.isValid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid password format'
        })
      };
    }
    
    console.log('Login attempt for username:', usernameValidation.value);
    
    // Authenticate user using database with validated credentials
    const authResult = await authenticateUser(usernameValidation.value, passwordValidation.value);
    console.log('Authentication result:', {
      success: authResult.success,
      username: usernameValidation.value,
      ip: clientIP
    });
    
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
    
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        ...(isDevelopment && {
          details: error.message,
          stack: error.stack
        })
      })
    };
  }
}; 
