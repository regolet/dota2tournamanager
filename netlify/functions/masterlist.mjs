// Masterlist function using Neon DB
import { getMasterlist, addMasterlistPlayer, updateMasterlistPlayer, deleteMasterlistPlayer } from './database.js';

// Calculate masterlist statistics
function calculateMasterlistStats(players) {
  if (!players || players.length === 0) {
    return {
      total: 0,
      avgMmr: 0,
      maxMmr: 0,
      minMmr: 0,
      topPlayer: 'N/A'
    };
  }
  
  const mmrValues = players.map(p => p.mmr || 0);
  const maxMmr = Math.max(...mmrValues);
  const minMmr = Math.min(...mmrValues);
  const avgMmr = Math.round(mmrValues.reduce((sum, mmr) => sum + mmr, 0) / mmrValues.length);
  
  // Find top player
  const topPlayer = players.find(p => p.mmr === maxMmr);
  
  return {
    total: players.length,
    avgMmr: avgMmr,
    maxMmr: maxMmr,
    minMmr: minMmr,
    topPlayer: topPlayer ? topPlayer.name : 'N/A'
  };
}

export const handler = async (event, context) => {
  try {
    
    
    
    // Handle CORS preflight
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
    
    // Get session ID for auth check
    const sessionId = event.headers['x-session-id'] || 
                     event.queryStringParameters?.sessionId;
    
    const isAuthenticated = sessionId && sessionId.length >= 10;
    
    // For non-GET operations, require authentication (except for POST which is for adding players)
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST' && !isAuthenticated) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Authentication required for this operation'
        })
      };
    }
    
    // Handle different HTTP methods
    if (event.httpMethod === 'GET') {
      // Get masterlist data from database
      const masterlistPlayers = await getMasterlist();
      
      // For public access, return basic info
      // For authenticated admin access, return full details
      const responseData = masterlistPlayers.map(player => {
        if (isAuthenticated) {
          // Admin view - full details
          return {
            id: player.id,
            name: player.name,
            dota2id: player.dota2id,
            mmr: player.mmr,
            team: player.team || '',
            achievements: player.achievements || '',
            notes: player.notes || '',
            created_at: player.created_at,
            updated_at: player.updated_at
          };
        } else {
          // Public view - limited details
          return {
            id: player.id,
            name: player.name,
            mmr: player.mmr,
            team: player.team || '',
            achievements: player.achievements || ''
          };
        }
      });
      
      // Calculate stats
      const stats = calculateMasterlistStats(responseData);
      
      console.log(`Returning ${responseData.length} masterlist players from database (auth: ${isAuthenticated})`);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          success: true,
          players: responseData,
          stats: stats,
          count: responseData.length,
          message: `Masterlist retrieved successfully from database (${isAuthenticated ? 'admin' : 'public'} view)`,
          isAuthenticated: isAuthenticated,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (event.httpMethod === 'POST') {
      // Add new masterlist player
      const requestBody = JSON.parse(event.body || '{}');
      
      try {
        await addMasterlistPlayer(requestBody);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            message: 'Player added to masterlist successfully',
            timestamp: new Date().toISOString()
          })
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: error.message,
            timestamp: new Date().toISOString()
          })
        };
      }
      
    } else if (event.httpMethod === 'PUT') {
      // Update existing masterlist player
      // Extract player ID from URL path
      const pathParts = event.path.split('/');
      const playerId = parseInt(pathParts[pathParts.length - 1]);
      const requestBody = JSON.parse(event.body || '{}');
      
      if (!playerId || isNaN(playerId)) {
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
      
      try {
        await updateMasterlistPlayer(playerId, requestBody);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            message: 'Masterlist player updated successfully',
            timestamp: new Date().toISOString()
          })
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: error.message,
            timestamp: new Date().toISOString()
          })
        };
      }
      
    } else if (event.httpMethod === 'DELETE') {
      // Delete masterlist player
      const pathParts = event.path.split('/');
      const playerId = parseInt(pathParts[pathParts.length - 1]);
      
      if (!playerId || isNaN(playerId)) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Valid player ID is required'
          })
        };
      }
      
      try {
        await deleteMasterlistPlayer(playerId);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            message: 'Masterlist player deleted successfully',
            timestamp: new Date().toISOString()
          })
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: error.message,
            timestamp: new Date().toISOString()
          })
        };
      }
      
    } else {
      // Method not allowed
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
        message: 'Internal server error: ' + error.message,
        error: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
}; 
