// Public player registration function
import { addPlayer, getPlayers, getMasterlist, updateMasterlistPlayer, addMasterlistPlayer } from './database.js';

export const handler = async (event, context) => {
  try {
    
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
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
    
    const { name, dota2id, peakmmr } = requestBody;
    
    // Validate required fields
    if (!name || !dota2id) {
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
    
    // Validate name length
    if (name.length < 2 || name.length > 50) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Player name must be between 2 and 50 characters'
        })
      };
    }
    
    // Validate Dota 2 ID (should be numeric)
    if (!/^\d+$/.test(dota2id)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Dota 2 ID must be numeric'
        })
      };
    }
    
    // Validate MMR if provided
    const mmr = parseInt(peakmmr) || 0;
    if (mmr < 0 || mmr > 15000) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Peak MMR must be between 0 and 15000'
        })
      };
    }
    
    // Get client IP address
    const clientIP = event.headers['x-forwarded-for'] || 
                    event.headers['x-real-ip'] || 
                    event.headers['cf-connecting-ip'] || 
                    'unknown';
    
    // Create player object
    const playerData = {
      name: name.trim(),
      dota2id: dota2id.trim(),
      peakmmr: mmr,
      ipAddress: clientIP.split(',')[0].trim(), // Take first IP if multiple
      registrationDate: new Date().toISOString()
    };
    
    // Check if player exists in masterlist for MMR verification
    let verifiedFromMasterlist = false;
    let verifiedMmr = null;
    
    try {
      const masterlist = await getMasterlist();
      const masterlistPlayer = masterlist.find(p => 
        p.dota2id === playerData.dota2id || 
        p.name.toLowerCase() === playerData.name.toLowerCase()
      );
      
      if (masterlistPlayer) {
        verifiedFromMasterlist = true;
        verifiedMmr = masterlistPlayer.mmr;
        playerData.peakmmr = masterlistPlayer.mmr; // Use masterlist MMR
      } else {
        // Add player to masterlist if not exists
        await addMasterlistPlayer({
          name: playerData.name,
          dota2id: playerData.dota2id,
          mmr: playerData.peakmmr
        });
      }
    } catch (masterlistError) {
      // Masterlist operations are not critical, continue with registration
    }
    
    // Add player to database
    await addPlayer(playerData);
    
    // Get the newly added player
    const allPlayers = await getPlayers();
    const newPlayer = allPlayers.find(p => p.dota2id === playerData.dota2id);
    
    if (!newPlayer) {
      throw new Error('Failed to retrieve newly added player');
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Player registered successfully!',
        player: {
          id: newPlayer.id,
          name: newPlayer.name,
          dota2id: newPlayer.dota2id,
          peakmmr: newPlayer.peakmmr,
          registrationDate: newPlayer.registration_date
        },
        verifiedFromMasterlist,
        verifiedMmr,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Add Player function error:', error);
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
