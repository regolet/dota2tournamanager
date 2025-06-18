// Simple masterlist API function
export const handler = async (event, context) => {
  try {
    console.log('Masterlist API called:', event.httpMethod, event.path);
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
        }
      };
    }
    
    // Get session ID for auth check
    const sessionId = event.headers['x-session-id'] || 
                     event.queryStringParameters?.sessionId;
    
    // Simple auth check
    if (!sessionId || sessionId.length < 10) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Authentication required'
        })
      };
    }
    
    // Handle different HTTP methods
    if (event.httpMethod === 'GET') {
      // Return mock masterlist data
      const mockMasterlist = [
        {
          id: 1,
          name: "Pro Player 1",
          dota2id: "111111111",
          mmr: 7500,
          created_at: "2025-01-18T10:00:00.000Z",
          notes: "Verified professional player"
        },
        {
          id: 2,
          name: "Pro Player 2", 
          dota2id: "222222222",
          mmr: 6800,
          created_at: "2025-01-18T11:00:00.000Z",
          notes: "High MMR player"
        }
      ];
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          masterlist: mockMasterlist,
          count: mockMasterlist.length
        })
      };
      
    } else if (event.httpMethod === 'POST') {
      // Handle adding/updating masterlist players
      let requestBody = {};
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
            message: 'Invalid JSON in request body'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Masterlist operation completed',
          data: requestBody
        })
      };
      
    } else {
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
    
  } catch (error) {
    console.error('Masterlist API error:', error);
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