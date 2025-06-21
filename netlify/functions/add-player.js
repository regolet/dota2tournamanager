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

// Simplified validation functions to avoid dependency issues
function validatePlayerData(name, dota2id, peakmmr) {
  const errors = [];
  
  if (!name || name.trim().length === 0) {
    errors.push('Player name is required');
  } else if (name.trim().length > 50) {
    errors.push('Player name must be no more than 50 characters');
  }
  
  if (!dota2id || dota2id.trim().length === 0) {
    errors.push('Dota 2 ID is required');
  } else if (dota2id.trim().length > 50) {
    errors.push('Dota 2 ID must be no more than 50 characters');
  }
  
  const mmrNum = parseInt(peakmmr, 10);
  if (isNaN(mmrNum) || mmrNum < 0 || mmrNum > 15000) {
    errors.push('MMR must be a valid number between 0 and 15,000');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    player: {
      name: name ? name.trim() : '',
      dota2id: dota2id ? dota2id.trim() : '',
      peakmmr: mmrNum || 0
    }
  };
}

// Simple rate limiting
const rateLimitStore = new Map();

function checkSimpleRateLimit(identifier, maxRequests = 5, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean old entries
  for (const [key, requests] of rateLimitStore.entries()) {
    rateLimitStore.set(key, requests.filter(time => time > windowStart));
    if (rateLimitStore.get(key).length === 0) {
      rateLimitStore.delete(key);
    }
  }
  
  const requests = rateLimitStore.get(identifier) || [];
  
  if (requests.length >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000) };
  }
  
  requests.push(now);
  rateLimitStore.set(identifier, requests);
  
  return { allowed: true };
}

export const handler = async (event, context) => {
  try {
    console.log('🔧 Add Player function started');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));
    
    // Rate limiting for public registration endpoint
    const clientIP = event.headers['x-forwarded-for'] || event.headers['cf-connecting-ip'] || 'unknown';
    const rateLimit = checkSimpleRateLimit(`add-player-${clientIP}`, 5, 60000);
    
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
      console.log('📋 Parsing request body...');
      requestBody = JSON.parse(event.body || '{}');
      console.log('✅ Request body parsed successfully');
    } catch (parseError) {
      console.error('❌ Error parsing request body:', parseError);
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
    console.log('📝 Player data received:', { name, dota2id, peakmmr, hasSessionId: !!registrationSessionId });
    
    // Validate player data using simplified validation
    const playerValidation = validatePlayerData(name, dota2id, peakmmr);
    if (!playerValidation.isValid) {
      console.log('❌ Player validation failed:', playerValidation.errors);
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
    
    console.log('✅ Player validation passed');
    
    // Validate registration session if provided
    let registrationSession = null;
    if (registrationSessionId) {
      try {
        console.log('🔍 Checking registration session...');
        registrationSession = await getRegistrationSessionBySessionId(registrationSessionId);
        
        if (!registrationSession) {
          console.log('❌ Registration session not found');
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
        
        console.log('✅ Registration session found:', registrationSession.title);
        
        // Check if registration session is active
        if (!registrationSession.isActive) {
          console.log('❌ Registration session is inactive');
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
          console.log('❌ Registration session has expired');
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
          console.log('❌ Registration session is full');
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
        console.error('❌ Error validating registration session:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Error validating registration session: ' + error.message
          })
        };
      }
    }
    
    // Create player object using validated data
    const playerData = {
      name: playerValidation.player.name,
      dota2id: playerValidation.player.dota2id,
      peakmmr: playerValidation.player.peakmmr,
      ipAddress: clientIP.split(',')[0].trim(), // Take first IP if multiple
      registrationDate: new Date().toISOString(),
      registrationSessionId: registrationSessionId // Link player to registration session
    };
    
    console.log('👤 Player data prepared for database:', playerData);
    
    // Check if player exists in masterlist for MMR verification
    let verifiedFromMasterlist = false;
    let verifiedMmr = null;
    
    try {
      console.log('📚 Checking masterlist...');
      const masterlist = await getMasterlist();
      const masterlistPlayer = masterlist.find(p => 
        p.dota2id === playerData.dota2id || 
        p.name.toLowerCase() === playerData.name.toLowerCase()
      );
      
      if (masterlistPlayer) {
        console.log('✅ Player found in masterlist, using verified MMR:', masterlistPlayer.mmr);
        verifiedFromMasterlist = true;
        verifiedMmr = masterlistPlayer.mmr;
        playerData.peakmmr = masterlistPlayer.mmr; // Use masterlist MMR
      } else {
        console.log('📝 Adding player to masterlist...');
        // Add player to masterlist if not exists
        await addMasterlistPlayer({
          name: playerData.name,
          dota2id: playerData.dota2id,
          mmr: playerData.peakmmr
        });
        console.log('✅ Player added to masterlist');
      }
    } catch (masterlistError) {
      console.warn('⚠️ Masterlist operations failed (non-critical):', masterlistError.message);
      // Masterlist operations are not critical, continue with registration
    }
    
    // Add player to database
    try {
      console.log('💾 Adding player to database...');
      await addPlayer(playerData);
      console.log('✅ Player added to database successfully');
    } catch (dbError) {
      console.error('❌ Database error adding player:', dbError);
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
    console.log('🔍 Retrieving newly added player...');
    const allPlayers = await getPlayers();
    const newPlayer = allPlayers.find(p => p.dota2id === playerData.dota2id);
    
    if (!newPlayer) {
      console.error('❌ Failed to retrieve newly added player');
      throw new Error('Failed to retrieve newly added player');
    }
    
    console.log('✅ New player retrieved successfully:', newPlayer.name);
    
    // Update registration session player count if applicable
    if (registrationSession) {
      try {
        console.log('📊 Updating registration session player count...');
        await incrementRegistrationPlayerCount(registrationSessionId);
        console.log('✅ Registration session player count updated');
      } catch (error) {
        console.error('⚠️ Error updating registration session player count (non-critical):', error);
        // Don't fail the registration if this fails, just log it
      }
    }
    
    console.log('🎉 Player registration completed successfully');
    
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
    console.error('💥 Add Player function critical error:', error);
    console.error('Error stack:', error.stack);
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
