export const handler = async (event, context) => {
  try {
    console.log('Test function called:', event.httpMethod, event.path);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Basic Netlify function is working!',
        timestamp: new Date().toISOString(),
        event: {
          httpMethod: event.httpMethod,
          path: event.path
        }
      })
    };
  } catch (error) {
    console.error('Test function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}; 