// Update Player API function with Neon DB integration
import { updatePlayer, validateSession } from './database.mjs';

export const handler = async (event, context) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
      };
    }
    
    // Only allow POST method
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
          error: 'Invalid JSON in request body'
        })
      };
    }
    
    const { playerId, updates } = requestBody;
    
    // Validate required fields
    if (!playerId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Player ID is required'
        })
      };
    }
    
    if (!updates || Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'No updates provided'
        })
      };
    }
    
    // Validate allowed update fields
    const allowedFields = ['name', 'dota2id', 'peakmmr', 'ipAddress', 'registrationSessionId', 'present'];
    const invalidFields = Object.keys(updates).filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: `Invalid update fields: ${invalidFields.join(', ')}`
        })
      };
    }
    
    try {
      // Update the player
      const updatedPlayers = await updatePlayer(playerId, updates);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Player updated successfully',
          players: updatedPlayers
        })
      };
      
    } catch (updateError) {
      console.error('Error updating player:', updateError);
      
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: updateError.message || 'Failed to update player'
        })
      };
    }
    
  } catch (error) {
    console.error('Update Player API error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
}; 