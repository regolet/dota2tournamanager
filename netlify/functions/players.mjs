// Players API function with Neon DB integration
import { getPlayers, savePlayers, addPlayer, updatePlayer, deletePlayer, validateSession } from './database.mjs';

export const handler = async (event, context) => {
  try {
    
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        }
      };
    }
    
    // Get session ID for auth check
    const sessionId = event.headers['x-session-id'] || event.headers['X-Session-Id'];
    
    // Validate session for admin operations
    if (event.httpMethod !== 'GET') {
      if (!sessionId) {
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'Authentication required'
          })
        };
      }
      
      try {
        const isValidSession = await validateSession(sessionId);
        if (!isValidSession) {
          return {
            statusCode: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              error: 'Invalid or expired session'
            })
          };
        }
      } catch (sessionError) {
        console.error('Session validation error:', sessionError);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'Session validation failed'
          })
        };
      }
    }
    
    // Handle different HTTP methods
    if (event.httpMethod === 'GET') {
      // Get session ID from query parameters for filtering
      const sessionId = event.queryStringParameters?.sessionId;
      
      // Get players from database (filtered by session if provided)
      const players = await getPlayers(sessionId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          players: players,
          count: players.length
        })
      };
      
    } else if (event.httpMethod === 'POST') {
      // Handle adding new player or updating existing
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
      
      const { action, player, players } = requestBody;
      
      if (action === 'add') {
        // Add single player
        if (!player || !player.name || !player.dota2id) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              error: 'Player name and Dota2ID are required'
            })
          };
        }
        
        await addPlayer(player);
        const updatedPlayers = await getPlayers();
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            message: 'Player added successfully',
            players: updatedPlayers
          })
        };
        
      } else if (action === 'edit') {
        // Edit existing player
        if (!player || !player.id) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              error: 'Player ID is required for editing'
            })
          };
        }
        
        await updatePlayer(player.id, {
          name: player.name,
          dota2id: player.dota2id,
          peakmmr: player.peakmmr
        });
        
        const updatedPlayers = await getPlayers();
        
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
        
      } else if (action === 'save' && players) {
        // Save multiple players (bulk operation)
        await savePlayers(players);
        const updatedPlayers = await getPlayers();
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            message: 'Players saved successfully',
            players: updatedPlayers
          })
        };
        
      } else {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'Invalid action or missing data'
          })
        };
      }
      
    } else if (event.httpMethod === 'DELETE') {
      // Handle player deletion
      const playerId = event.queryStringParameters?.id;
      
      if (!playerId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'Player ID is required for deletion'
          })
        };
      }
      
      await deletePlayer(playerId);
      const updatedPlayers = await getPlayers();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Player deleted successfully',
          players: updatedPlayers
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
          error: 'Method not allowed'
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
        error: 'Internal server error: ' + error.message
      })
    };
  }
}; 
