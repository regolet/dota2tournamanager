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
    
    // Only handle GET requests for this endpoint
    if (event.httpMethod !== 'GET') {
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
    
    // Get session ID for auth check (optional for masterlist)
    const sessionId = event.headers['x-session-id'] || 
                     event.queryStringParameters?.sessionId;
    
    const isAuthenticated = sessionId && sessionId.length >= 10;
    
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