// Public players API function (no auth required)
export const handler = async (event, context) => {
  try {
    console.log('Public Players API called:', event.httpMethod, event.path);
    console.log('Raw path:', event.rawPath);
    console.log('Query parameters:', event.queryStringParameters);
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      };
    }
    
    // Handle different HTTP methods
    if (event.httpMethod === 'GET') {
      // Return mock player data for team balancer and player list
      const mockPlayers = [
        {
          id: "player_1",
          name: "Alice Johnson",
          dota2id: "123456789",
          peakmmr: 3500,
          registrationDate: "2025-01-18T10:00:00.000Z",
          ipAddress: "192.168.1.1"
        },
        {
          id: "player_2", 
          name: "Bob Smith",
          dota2id: "987654321",
          peakmmr: 4200,
          registrationDate: "2025-01-18T11:00:00.000Z",
          ipAddress: "192.168.1.2"
        },
        {
          id: "player_3",
          name: "Charlie Brown",
          dota2id: "456789123",
          peakmmr: 2800,
          registrationDate: "2025-01-18T12:00:00.000Z",
          ipAddress: "192.168.1.3"
        },
        {
          id: "player_4",
          name: "Diana Prince",
          dota2id: "789123456",
          peakmmr: 5100,
          registrationDate: "2025-01-18T13:00:00.000Z",
          ipAddress: "192.168.1.4"
        },
        {
          id: "player_5",
          name: "Edward Norton",
          dota2id: "321654987",
          peakmmr: 3800,
          registrationDate: "2025-01-18T14:00:00.000Z",
          ipAddress: "192.168.1.5"
        },
        {
          id: "player_6",
          name: "Fiona Green",
          dota2id: "654987321",
          peakmmr: 4500,
          registrationDate: "2025-01-18T15:00:00.000Z",
          ipAddress: "192.168.1.6"
        },
        {
          id: "player_7",
          name: "George Wilson",
          dota2id: "147258369",
          peakmmr: 3200,
          registrationDate: "2025-01-18T16:00:00.000Z",
          ipAddress: "192.168.1.7"
        },
        {
          id: "player_8",
          name: "Helen Davis",
          dota2id: "369258147",
          peakmmr: 4800,
          registrationDate: "2025-01-18T17:00:00.000Z",
          ipAddress: "192.168.1.8"
        },
        {
          id: "player_9",
          name: "Ivan Petrov",
          dota2id: "555666777",
          peakmmr: 4100,
          registrationDate: "2025-01-18T18:00:00.000Z",
          ipAddress: "192.168.1.9"
        },
        {
          id: "player_10",
          name: "Julia Martinez",
          dota2id: "888999000",
          peakmmr: 3600,
          registrationDate: "2025-01-18T19:00:00.000Z",
          ipAddress: "192.168.1.10"
        }
      ];
      
      console.log(`Returning ${mockPlayers.length} players`);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          players: mockPlayers,
          count: mockPlayers.length,
          message: 'Players retrieved successfully'
        })
      };
      
    } else if (event.httpMethod === 'POST') {
      // Handle player registration
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
      
      const { name, dota2id, peakmmr } = requestBody;
      
      if (!name || !dota2id) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Player name and Dota 2 ID are required'
          })
        };
      }
      
      // Mock successful registration
      const newPlayer = {
        id: `player_${Date.now()}`,
        name: name,
        dota2id: dota2id,
        peakmmr: peakmmr || 0,
        registrationDate: new Date().toISOString(),
        ipAddress: event.headers['x-forwarded-for'] || 'unknown'
      };
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Player registered successfully!',
          player: newPlayer
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
    console.error('Public Players API error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error: ' + error.message,
        error: error.toString()
      })
    };
  }
}; 