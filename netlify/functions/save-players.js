// Admin save-players function for player management operations with persistent storage
import { getStoredPlayers, setStoredPlayers } from './get-players.js';

export const handler = async (event, context) => {
  try {
    console.log('Save Players API called:', event.httpMethod, event.path);
    console.log('Request body:', event.body);
    console.log('Headers:', event.headers);
    
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
    
    console.log('Parsed request body:', requestBody);
    
    // Handle different operations
    const { action, players, playerId, player } = requestBody;
    
    // Get current players from storage
    let currentPlayers = getStoredPlayers();
    
    if (action === 'removeAll' || requestBody.removeAll === true) {
      // Remove all players operation
      console.log('Removing all players...');
      const removedCount = currentPlayers.length;
      
      // Clear all players
      setStoredPlayers([]);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'All players have been removed successfully',
          removedCount: removedCount,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'edit' && player) {
      // Edit/update specific player
      console.log('Editing player:', player);
      
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
      
      // Find and update the player
      const playerIndex = currentPlayers.findIndex(p => p.id === player.id);
      if (playerIndex === -1) {
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
      
      // Update the player
      currentPlayers[playerIndex] = {
        ...currentPlayers[playerIndex],
        name: player.name,
        peakmmr: player.peakmmr || 0,
        dota2id: player.dota2id
      };
      
      // Save updated players
      setStoredPlayers(currentPlayers);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: `Player "${player.name}" has been updated successfully`,
          updatedPlayer: currentPlayers[playerIndex],
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'add' && player) {
      // Add new player
      console.log('Adding new player:', player);
      
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
      
      // Check for duplicate names
      if (currentPlayers.some(p => p.name.toLowerCase() === player.name.toLowerCase())) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'A player with this name already exists'
          })
        };
      }
      
      // Create new player object
      const newPlayer = {
        id: player.id || 'player_' + Date.now(),
        name: player.name,
        peakmmr: player.peakmmr || 0,
        dota2id: player.dota2id,
        registrationDate: player.registrationDate || new Date().toISOString(),
        ipAddress: '192.168.1.' + Math.floor(Math.random() * 200 + 50) // Mock IP
      };
      
      // Add to players array
      currentPlayers.push(newPlayer);
      
      // Save updated players
      setStoredPlayers(currentPlayers);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: `Player "${player.name}" has been added successfully`,
          addedPlayer: newPlayer,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'delete' && playerId) {
      // Delete specific player
      console.log('Deleting player:', playerId);
      
      // Find player index
      const playerIndex = currentPlayers.findIndex(p => p.id === playerId);
      if (playerIndex === -1) {
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
      
      // Remove player
      const deletedPlayer = currentPlayers.splice(playerIndex, 1)[0];
      
      // Save updated players
      setStoredPlayers(currentPlayers);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: `Player "${deletedPlayer.name}" has been deleted successfully`,
          deletedPlayerId: playerId,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'remove' && playerId) {
      // Remove specific player (alias for delete)
      console.log('Removing player:', playerId);
      
      // Find player index
      const playerIndex = currentPlayers.findIndex(p => p.id === playerId);
      if (playerIndex === -1) {
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
      
      // Remove player
      const removedPlayer = currentPlayers.splice(playerIndex, 1)[0];
      
      // Save updated players
      setStoredPlayers(currentPlayers);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: `Player "${removedPlayer.name}" has been removed successfully`,
          removedPlayerId: playerId,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (action === 'save' || players) {
      // Save/update players operation
      console.log('Saving players...');
      
      if (Array.isArray(players)) {
        // Replace all players with provided array
        setStoredPlayers(players);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            message: 'Players have been saved successfully',
            savedCount: players.length,
            timestamp: new Date().toISOString()
          })
        };
      }
      
    } else {
      // Default operation - treat as save
      console.log('Default save operation...');
      
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