// Masterlist function using persistent database storage
import { masterlistDb } from './database.js';

export const handler = async (event, context) => {
  try {
    console.log('Masterlist API called:', event.httpMethod, event.path);
    console.log('Headers:', event.headers);
    
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
    
    // For non-GET operations, require authentication
    if (event.httpMethod !== 'GET' && !isAuthenticated) {
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
      const masterlistPlayers = await masterlistDb.getAllPlayers();
      
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
          count: responseData.length,
          message: `Masterlist retrieved successfully from database (${isAuthenticated ? 'admin' : 'public'} view)`,
          isAuthenticated: isAuthenticated,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (event.httpMethod === 'POST') {
      // Add new masterlist player
      const requestBody = JSON.parse(event.body || '{}');
      const result = await masterlistDb.addPlayer(requestBody);
      
      return {
        statusCode: result.success ? 200 : 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: result.success,
          message: result.success ? 'Player added to masterlist successfully' : result.error,
          player: result.player || null,
          timestamp: new Date().toISOString()
        })
      };
      
    } else if (event.httpMethod === 'PUT') {
      // Update existing masterlist player
      const playerId = parseInt(event.pathParameters?.id);
      const requestBody = JSON.parse(event.body || '{}');
      
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
      
      const result = await masterlistDb.updatePlayer(playerId, requestBody);
      
      return {
        statusCode: result.success ? 200 : 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: result.success,
          message: result.success ? 'Masterlist player updated successfully' : result.error,
          player: result.player || null,
          timestamp: new Date().toISOString()
        })
      };
      
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
      
      const result = await masterlistDb.deletePlayer(playerId);
      
      return {
        statusCode: result.success ? 200 : 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: result.success,
          message: result.success ? 'Masterlist player deleted successfully' : result.error,
          player: result.player || null,
          timestamp: new Date().toISOString()
        })
      };
      
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