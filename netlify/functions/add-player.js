// Public player registration function
import { 
  addPlayer, 
  getPlayers, 
  getMasterlist, 
  updateMasterlistPlayer, 
  addMasterlistPlayer,
  getRegistrationSessionBySessionId,
  incrementRegistrationPlayerCount
} from './database.js';
import { 
  validatePlayer, 
  validateSessionId, 
  checkRateLimit, 
  sanitizeForLogging 
} from './validation-utils.js';

export const handler = async (event, context) => {
  try {
    // Rate limiting for public registration endpoint
    const clientIP = event.headers['x-forwarded-for'] || event.headers['cf-connecting-ip'] || 'unknown';
    const rateLimit = checkRateLimit(`add-player-${clientIP}`, 5, 60000); // 5 registrations per minute per IP
    
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for player registration from IP: ${clientIP}`);
      return {
        statusCode: 429,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Retry-After': rateLimit.retryAfter.toString()
        },
        body: JSON.stringify({
          success: false,
          message: 'Too many registration attempts. Please wait before trying again.',
          retryAfter: rateLimit.retryAfter
        })
      };
    }
    
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
    
    const { name, dota2id, peakmmr, registrationSessionId } = requestBody;
    
    // Log sanitized request for debugging
    console.log('Player registration attempt:', {
      ip: clientIP,
      hasSessionId: !!registrationSessionId,
      body: sanitizeForLogging(requestBody)
    });
    
    // Validate player data using comprehensive validation
    const playerValidation = validatePlayer({ name, dota2id, peakmmr }, false);
    if (!playerValidation.isValid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid player data: ' + playerValidation.errors.join(', '),
          errors: playerValidation.errors
        })
      };
    }
    
    // Validate session ID format if provided
    if (registrationSessionId) {
      const sessionIdValidation = validateSessionId(registrationSessionId, false);
      if (!sessionIdValidation.isValid) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Invalid registration session ID format'
          })
        };
      }
    }
    
    // Validate registration session if provided
    let registrationSession = null;
    if (registrationSessionId) {
      try {
        registrationSession = await getRegistrationSessionBySessionId(registrationSessionId);
        
        if (!registrationSession) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Registration session not found or expired'
            })
          };
        }
        
        // Check if registration session is active
        if (!registrationSession.isActive) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Registration is currently closed'
            })
          };
        }
        
        // Check if registration session has expired
        if (registrationSession.expiresAt && new Date() > new Date(registrationSession.expiresAt)) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Registration has expired'
            })
          };
        }
        
        // Check if registration session is full
        if (registrationSession.playerCount >= registrationSession.maxPlayers) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: `Registration is full (${registrationSession.maxPlayers} players maximum)`
            })
          };
        }
      } catch (error) {
        console.error('Error validating registration session:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Error validating registration session'
          })
        };
      }
    }
    
    // Client IP already extracted at top for rate limiting
    
    // Create player object using validated data
    const playerData = {
      name: playerValidation.player.name,
      dota2id: playerValidation.player.dota2id,
      peakmmr: playerValidation.player.peakmmr,
      ipAddress: clientIP.split(',')[0].trim(), // Take first IP if multiple
      registrationDate: new Date().toISOString(),
      registrationSessionId: registrationSessionId // Link player to registration session
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
    try {
      await addPlayer(playerData);
    } catch (dbError) {
      // Handle specific database errors
      if (dbError.message.includes('already exists')) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'A player with this name or Dota 2 ID is already registered. Please use a different name or check if you have already registered.',
            errorType: 'DUPLICATE_PLAYER'
          })
        };
      }
      // Re-throw other database errors
      throw dbError;
    }
    
    // Get the newly added player
    const allPlayers = await getPlayers();
    const newPlayer = allPlayers.find(p => p.dota2id === playerData.dota2id);
    
    if (!newPlayer) {
      throw new Error('Failed to retrieve newly added player');
    }
    
    // Update registration session player count if applicable
    if (registrationSession) {
      try {
        await incrementRegistrationPlayerCount(registrationSessionId);
      } catch (error) {
        console.error('Error updating registration session player count:', error);
        // Don't fail the registration if this fails, just log it
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
        registrationSession: registrationSession ? {
          title: registrationSession.title,
          adminUsername: registrationSession.adminUsername
        } : null,
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
