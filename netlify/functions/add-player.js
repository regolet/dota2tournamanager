// Public add player function for registration
export const handler = async (event, context) => {
  try {
    console.log('Add Player API called:', event.httpMethod, event.path);
    console.log('Request body:', event.body);
    
    // Handle CORS preflight
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
    
    // Only handle POST requests
    if (event.httpMethod !== 'POST') {
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
    
    // Parse request body
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
    
    console.log('Registration attempt:', { name, dota2id, peakmmr });
    
    // Validate required fields
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
    
    // Validate Dota2 ID format (should be numeric)
    if (!/^\d+$/.test(dota2id)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Dota 2 ID must be numeric'
        })
      };
    }
    
    // Mock successful registration
    const newPlayer = {
      id: `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: name.trim(),
      dota2id: dota2id.trim(),
      peakmmr: parseInt(peakmmr) || 0,
      registrationDate: new Date().toISOString(),
      ipAddress: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown'
    };
    
    console.log('Player registered successfully:', newPlayer);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Player registered successfully! Welcome to the tournament.',
        player: newPlayer
      })
    };
    
  } catch (error) {
    console.error('Add Player API error:', error);
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