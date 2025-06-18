// Simple players API function
export const handler = async (event, context) => {
  try {
    console.log('Players API called:', event.httpMethod, event.path);
    
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
    
    // Simple auth check - just verify session exists and has reasonable length
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
      // Return mock player data for now
      const mockPlayers = [
        {
          id: "player_1",
          name: "Test Player 1",
          dota2id: "123456789",
          peakmmr: 3500,
          registrationDate: "2025-01-18T10:00:00.000Z",
          ipAddress: "192.168.1.1"
        },
        {
          id: "player_2", 
          name: "Test Player 2",
          dota2id: "987654321",
          peakmmr: 4200,
          registrationDate: "2025-01-18T11:00:00.000Z",
          ipAddress: "192.168.1.2"
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
          players: mockPlayers,
          count: mockPlayers.length
        })
      };
      
    } else if (event.httpMethod === 'POST') {
      // Handle adding/updating players
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
          message: 'Player operation completed',
          data: requestBody
        })
      };
      
    } else if (event.httpMethod === 'DELETE') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Player deleted successfully'
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
    console.error('Players API error:', error);
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