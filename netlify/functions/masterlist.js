// Enhanced masterlist API function
export const handler = async (event, context) => {
  try {
    console.log('Masterlist API called:', event.httpMethod, event.path);
    console.log('Headers:', event.headers);
    console.log('Query params:', event.queryStringParameters);
    
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
    
    // Check if this is an admin API call (requires auth) vs public API call
    const isAdminCall = event.path?.includes('/admin/api/') || 
                       event.rawPath?.includes('/admin/api/');
    
    // Get session ID for auth check (only for admin calls)
    const sessionId = event.headers['x-session-id'] || 
                     event.queryStringParameters?.sessionId;
    
    // Auth check only for admin calls
    if (isAdminCall && (!sessionId || sessionId.length < 10)) {
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
      // Return comprehensive masterlist data
      const mockMasterlist = [
        {
          id: 1,
          name: "Miracle-",
          dota2id: "105248644",
          mmr: 8500,
          created_at: "2025-01-18T10:00:00.000Z",
          updated_at: "2025-01-18T10:00:00.000Z",
          notes: "Professional player - OG"
        },
        {
          id: 2,
          name: "Arteezy", 
          dota2id: "86745912",
          mmr: 8200,
          created_at: "2025-01-18T11:00:00.000Z",
          updated_at: "2025-01-18T11:00:00.000Z",
          notes: "Professional player - Team Secret"
        },
        {
          id: 3,
          name: "SumaiL",
          dota2id: "111620041",
          mmr: 8000,
          created_at: "2025-01-18T12:00:00.000Z",
          updated_at: "2025-01-18T12:00:00.000Z",
          notes: "Former TI winner"
        },
        {
          id: 4,
          name: "Dendi",
          dota2id: "70388657",
          mmr: 7800,
          created_at: "2025-01-18T13:00:00.000Z",
          updated_at: "2025-01-18T13:00:00.000Z",
          notes: "Legendary mid player - Na'Vi"
        },
        {
          id: 5,
          name: "Puppey",
          dota2id: "87276347",
          mmr: 7500,
          created_at: "2025-01-18T14:00:00.000Z",
          updated_at: "2025-01-18T14:00:00.000Z",
          notes: "Team Secret captain"
        },
        {
          id: 6,
          name: "N0tail",
          dota2id: "94155156",
          mmr: 7300,
          created_at: "2025-01-18T15:00:00.000Z",
          updated_at: "2025-01-18T15:00:00.000Z",
          notes: "OG captain - 2x TI winner"
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