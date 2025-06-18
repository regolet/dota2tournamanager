// Simple session check function
export const handler = async (event, context) => {
  try {
    console.log('Session check called:', event.httpMethod, event.path);
    console.log('Headers:', event.headers);
    console.log('Query params:', event.queryStringParameters);
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        }
      };
    }
    
    // Only handle GET requests
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Method not allowed'
        })
      };
    }
    
    // Get session ID from headers or query params
    const sessionId = event.headers['x-session-id'] || 
                     event.queryStringParameters?.sessionId;
    
    console.log('Checking session ID:', sessionId);
    
    // For now, accept any session ID that looks valid (has content)
    // In a real app, you'd validate against stored sessions
    if (sessionId && sessionId.length > 10) {
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
            username: 'admin',
            role: 'admin'
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
          message: 'Session is invalid or expired'
        })
      };
    }
    
  } catch (error) {
    console.error('Session check error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error: ' + error.message
      })
    };
  }
}; 