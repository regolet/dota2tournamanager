// Public API players function using persistent database storage
import { playerDb } from './database.js';

export const handler = async (event, context) => {
  try {
    console.log('API Players function called:', event.httpMethod, event.path);
    console.log('PlayerDb available:', !!playerDb);
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
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
    
    // Get players from database
    const players = await playerDb.getAllPlayers();
    
    // Format for team balancer - only include essential data
    const formattedPlayers = players.map(player => ({
      id: player.id,
      name: player.name,
      mmr: player.peakmmr || 0,
      dota2id: player.dota2id
    }));
    
    console.log(`Returning ${formattedPlayers.length} players for team balancer from database`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        success: true,
        players: formattedPlayers,
        count: formattedPlayers.length,
        message: 'Players retrieved successfully from database for team balancer',
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('API Players function error:', error);
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