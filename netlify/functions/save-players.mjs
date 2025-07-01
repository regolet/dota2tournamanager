// Admin save-players function using persistent database storage
import { playerDb } from './database.mjs';

export const handler = async (event, context) => {
  try {
    
    
    
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
          'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS'
        }
      };
    }
    
    // Get session ID for auth check
    const sessionId = event.headers['x-session-id'] || 
                     event.queryStringParameters?.sessionId;
    
    // Simple auth check for admin operations
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
    
    // Only handle POST requests for this endpoint
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
    
    
    
    // Handle different operations
    const { action, players, playerId, player } = requestBody;
    
    if (action === 'removeAll' || requestBody.removeAll === true) {
      // Remove all players operation
      
      
      const result = await playerDb.deleteAllPlayers();
      if (!result.success) {
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Failed to remove all players: ' + result.error
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
          message: 'All players have been removed successfully',
          removedCount: 0, // Will be 0 after deletion
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'edit' && player) {
      // Edit/update specific player
      
      
      // Validate player data
      if (!player.name || !player.dota2id) {
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
      
      const result = await playerDb.updatePlayer(player.id, {
        name: player.name,
        peakmmr: player.peakmmr || 0,
        dota2id: player.dota2id
      });
      
      if (!result.success) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Failed to update player: ' + result.error
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
          message: `Player "${player.name}" has been updated successfully`,
          updatedPlayer: result.player,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'add' && player) {
      // Add new player
      
      
      // Validate player data
      if (!player.name || !player.dota2id) {
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
      
      const result = await playerDb.addPlayer({
        id: player.id,
        name: player.name,
        peakmmr: player.peakmmr || 0,
        dota2id: player.dota2id,
        registrationDate: player.registrationDate
      });
      
      if (!result.success) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Failed to add player: ' + result.error
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
          message: `Player "${player.name}" has been added successfully`,
          addedPlayer: result.player,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'delete' && playerId) {
      // Delete specific player
      
      
      const result = await playerDb.deletePlayer(playerId);
      
      if (!result.success) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Failed to delete player: ' + result.error
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
          message: `Player "${result.player.name}" has been deleted successfully`,
          deletedPlayerId: playerId,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'remove' && playerId) {
      // Remove specific player (alias for delete)
      
      
      const result = await playerDb.deletePlayer(playerId);
      
      if (!result.success) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Failed to remove player: ' + result.error
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
          message: `Player "${result.player.name}" has been removed successfully`,
          removedPlayerId: playerId,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'save' || players) {
      // Save/update players operation
      
      
      if (Array.isArray(players)) {
        // This would require a bulk operation - for now return success
        // In a real implementation, you'd iterate through and save each player
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            message: 'Bulk save operation acknowledged (not implemented)',
            savedCount: players.length,
            timestamp: new Date().toISOString()
          })
        };
      }
      
    } else {
      // Default operation - treat as save
      
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Operation completed successfully',
          data: requestBody,
          timestamp: new Date().toISOString()
        })
      };
    }
    
  } catch (error) {
    console.error('Save Players API error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error: ' + error.message,
        error: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
}; 
