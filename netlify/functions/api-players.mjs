// Players API with registration session support
import { 
  getPlayers, 
  addPlayer, 
  updatePlayer, 
  deletePlayer, 
  savePlayers,
  getPlayersForAdmin,
  validateSession,
  deleteAllPlayersForSession,
  getRegistrationSessionBySessionId,
  getPlayerById
} from './database.mjs';

export const handler = async (event, context) => {
  try {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        }
      };
    }

    // Get session ID for admin operations
    const sessionId = event.headers['x-session-id'];
    let sessionValidation = null;
    
    // Validate session if provided (for admin operations)
    if (sessionId) {
      try {
        sessionValidation = await validateSession(sessionId);
        if (!sessionValidation.valid) {
          return {
            statusCode: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Invalid or expired session'
            })
          };
        }
      } catch (error) {
        console.error('Session validation error:', error);
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Session validation failed'
          })
        };
      }
    }

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetPlayers(event, sessionValidation);
      case 'POST':
        return await handleAddPlayer(event, sessionValidation);
      case 'PUT':
        return await handleUpdatePlayer(event, sessionValidation);
      case 'DELETE':
        return await handleDeletePlayer(event, sessionValidation);
      default:
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
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};

async function handleGetPlayers(event, sessionValidation) {
  try {
    const urlParams = new URLSearchParams(event.queryStringParameters || {});
    const registrationSessionId = urlParams.get('sessionId');
    const includeSessionInfo = urlParams.get('includeSessionInfo') === 'true';
    const presentOnly = urlParams.get('presentOnly') === 'true';

    let players;

    if (sessionValidation) {
      // Admin is authenticated
      if (registrationSessionId) {
        // Get players for specific session - validate admin ownership
        if (sessionValidation.role !== 'superadmin') {
          // For regular admins, verify they own this session
          const session = await getRegistrationSessionBySessionId(registrationSessionId);
          if (!session || session.adminUserId !== sessionValidation.userId) {
            return {
              statusCode: 403,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                success: false,
                message: 'Access denied: You can only view players from your own tournaments'
              })
            };
          }
        }
        // Get players for specific session
        players = await getPlayers(registrationSessionId, presentOnly);
      } else if (sessionValidation.role === 'superadmin') {
        // Super admin can see all players
        players = await getPlayers();
      } else {
        // Regular admin sees only their tournament players
        players = await getPlayersForAdmin(sessionValidation.userId, includeSessionInfo);
      }
    } else {
      // Public access - only allow specific session queries
      if (registrationSessionId) {
        players = await getPlayers(registrationSessionId, presentOnly);
      } else {
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Authentication required for global player access'
          })
        };
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        players: players || []
      })
    };

  } catch (error) {
    console.error('Error getting players:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Failed to get players',
        error: error.message
      })
    };
  }
}

async function handleAddPlayer(event, sessionValidation) {
  try {
    if (!sessionValidation) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Authentication required to add players'
        })
      };
    }

    const playerData = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!playerData.name || !playerData.dota2id) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Player name and Dota2ID are required'
        })
      };
    }

    // Validate admin ownership for regular admins
    if (sessionValidation.role !== 'superadmin' && playerData.registrationSessionId) {
      const session = await getRegistrationSessionBySessionId(playerData.registrationSessionId);
      if (!session || session.adminUserId !== sessionValidation.userId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Access denied: You can only add players to your own tournaments'
          })
        };
      }
    }

    // Add the player
    const players = await addPlayer(playerData);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Player added successfully',
        players: players
      })
    };

  } catch (error) {
    console.error('Error adding player:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: error.message || 'Failed to add player'
      })
    };
  }
}

async function handleUpdatePlayer(event, sessionValidation) {
  try {
    if (!sessionValidation) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Authentication required to update players'
        })
      };
    }

    const updateData = JSON.parse(event.body || '{}');
    const { playerId, ...updates } = updateData;

    if (!playerId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Player ID is required'
        })
      };
    }

    // Validate admin ownership for regular admins
    if (sessionValidation.role !== 'superadmin') {
      const player = await getPlayerById(playerId);
      if (!player || !player.registrationSessionId) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Player not found'
          })
        };
      }
      
      const session = await getRegistrationSessionBySessionId(player.registrationSessionId);
      if (!session || session.adminUserId !== sessionValidation.userId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Access denied: You can only modify players from your own tournaments'
          })
        };
      }
    }

    const players = await updatePlayer(playerId, updates);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Player updated successfully',
        players: players
      })
    };

  } catch (error) {
    console.error('Error updating player:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: error.message || 'Failed to update player'
      })
    };
  }
}

async function handleDeletePlayer(event, sessionValidation) {
  try {
    if (!sessionValidation) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Authentication required to delete players'
        })
      };
    }

    const { playerId, action, sessionId } = JSON.parse(event.body || '{}');

    // Bulk delete support
    if (action === 'removeAll' && sessionId) {
      // Validate admin ownership for bulk delete
      if (sessionValidation.role !== 'superadmin') {
        const session = await getRegistrationSessionBySessionId(sessionId);
        if (!session || session.adminUserId !== sessionValidation.userId) {
          return {
            statusCode: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Access denied: You can only delete players from your own tournaments'
            })
          };
        }
      }
      
      const result = await deleteAllPlayersForSession(sessionId);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: result.message,
          sessionId: result.sessionId
        })
      };
    }

    if (!playerId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Player ID is required'
        })
      };
    }

    // Validate admin ownership for regular admins
    if (sessionValidation.role !== 'superadmin') {
      const player = await getPlayerById(playerId);
      if (!player || !player.registrationSessionId) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Player not found'
          })
        };
      }
      
      const session = await getRegistrationSessionBySessionId(player.registrationSessionId);
      if (!session || session.adminUserId !== sessionValidation.userId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Access denied: You can only delete players from your own tournaments'
          })
        };
      }
    }

    const players = await deletePlayer(playerId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Player deleted successfully',
        players: players
      })
    };

  } catch (error) {
    console.error('Error deleting player:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: error.message || 'Failed to delete player'
      })
    };
  }
} 