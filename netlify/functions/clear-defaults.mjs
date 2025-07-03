// One-time cleanup function to remove default players from database
import { sql } from './database.mjs';

export const handler = async (event, context) => {
  try {
    
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
      };
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Method not allowed. Use POST.'
        })
      };
    }
    
    // Get session ID for auth check
    const sessionId = event.headers['x-session-id'] || 
                     event.queryStringParameters?.sessionId;
    
    const isAuthenticated = sessionId && sessionId.length >= 10;
    
    if (!isAuthenticated) {
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
    
    
    
    // Remove the specific default players by their known Dota2 IDs
    const defaultDota2Ids = [
      '105248644', // Miracle-
      '86745912',  // Arteezy
      '111620041', // SumaiL
      '70388657',  // Dendi
      '87276347',  // Puppey
      '19672354'   // N0tail
    ];
    
    let deletedCount = 0;
    
    for (const dota2id of defaultDota2Ids) {
      const result = await sql`
        DELETE FROM masterlist WHERE dota2id = ${dota2id}
      `;
      deletedCount += result.count || 0;
    }
    
    // Also remove the default sample player
    const playerResult = await sql`
      DELETE FROM players WHERE id = 'player_1750218791586_198'
    `;
    
    
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: `Successfully removed ${deletedCount} default masterlist players and ${playerResult.count || 0} sample players`,
        deletedMasterlistPlayers: deletedCount,
        deletedSamplePlayers: playerResult.count || 0,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error clearing defaults:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error: ' + error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 
