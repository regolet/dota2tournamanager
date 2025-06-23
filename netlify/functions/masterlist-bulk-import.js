// Enhanced Masterlist bulk import function using Neon DB
import { getMasterlist, addMasterlistPlayer, updateMasterlistPlayer } from './database.js';

export const handler = async (event, context) => {
  try {
    console.log('Enhanced bulk import started');
    console.log('Event method:', event.httpMethod);
    console.log('Event headers:', event.headers);
    console.log('Event body length:', event.body ? event.body.length : 'null');
    
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
    
    // Only allow POST method
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Method not allowed. Only POST is supported.'
        })
      };
    }
    
    // Get session ID for auth check
    const sessionId = event.headers['x-session-id'] || 
                     event.queryStringParameters?.sessionId;
    
    console.log('Session ID:', sessionId);
    const isAuthenticated = sessionId && sessionId.length >= 10;
    console.log('Is authenticated:', isAuthenticated);
    
    // Require authentication
    if (!isAuthenticated) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Authentication required for bulk import'
        })
      };
    }
    
    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
      console.log('JSON parsing successful');
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid JSON in request body: ' + parseError.message,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    const { players, skipDuplicates = true, updateExisting = false } = requestBody;
    
    console.log('=== SERVER RECEIVED DATA DEBUG ===');
    console.log('Raw event body:', event.body);
    console.log('Parsed request body:', requestBody);
    console.log('Extracted players:', players);
    console.log('Players type:', typeof players);
    console.log('Players is array:', Array.isArray(players));
    console.log('Players length:', players ? players.length : 'null');
    console.log('Skip duplicates:', skipDuplicates);
    console.log('Update existing:', updateExisting);
    console.log('=== END SERVER RECEIVED DATA DEBUG ===');
    
    console.log(`Processing ${players?.length || 0} players for bulk import`);
    
    // Validate input
    if (!players || !Array.isArray(players) || players.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Players array is required and must not be empty'
        })
      };
    }
    
    // Enhanced validation with detailed error reporting
    console.log('Starting validation...');
    const validationResults = validatePlayers(players);
    const { validPlayers, validationErrors } = validationResults;
    
    console.log(`Validation complete: ${validPlayers.length} valid, ${validationErrors.length} errors`);
    
    // If there are validation errors, return them immediately
    if (validationErrors.length > 0) {
      console.log('Returning validation errors:', validationErrors);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Validation errors occurred',
          validationErrors: validationErrors,
          total: players.length,
          valid: validPlayers.length,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Get existing players for duplicate checking
    console.log('Getting existing players...');
    const existingPlayers = await getMasterlist();
    const existingDota2Ids = new Set(existingPlayers.map(p => p.dota2id));
    
    // Process players with enhanced error handling
    console.log('Processing players...');
    const processResults = await processPlayers(validPlayers, existingPlayers, existingDota2Ids, skipDuplicates, updateExisting);
    
    const { added, updated, skipped, processingErrors } = processResults;
    
    console.log(`Bulk import completed: ${added} added, ${updated} updated, ${skipped} skipped, ${validationErrors.length} validation errors, ${processingErrors.length} processing errors`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Bulk import completed successfully',
        added: added,
        updated: updated,
        skipped: skipped,
        validationErrors: validationErrors,
        processingErrors: processingErrors,
        total: players.length,
        valid: validPlayers.length,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Enhanced bulk import API error:', error);
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
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Enhanced player validation
function validatePlayers(players) {
  const validPlayers = [];
  const validationErrors = [];
  
  console.log(`Starting validation of ${players.length} players`);
  
  players.forEach((player, index) => {
    const playerIndex = index + 1;
    
    // Debug logging for validation
    console.log(`Validating player ${playerIndex}:`, {
      name: player.name,
      nameType: typeof player.name,
      nameLength: player.name ? player.name.length : 'null',
      nameTrimmed: player.name ? player.name.trim() : 'null',
      nameTrimmedLength: player.name ? player.name.trim().length : 'null',
      dota2id: player.dota2id,
      mmr: player.mmr,
      mmrType: typeof player.mmr,
      notes: player.notes
    });
    
    // Enhanced name validation
    const trimmedName = player.name ? player.name.trim() : '';
    if (!trimmedName || trimmedName.length < 2) {
      const errorMsg = `Player ${playerIndex}: Invalid name (must be at least 2 characters) - got: "${player.name}"`;
      console.error(`Validation error: ${errorMsg}`);
      validationErrors.push(errorMsg);
      return;
    }
    
    if (trimmedName.length > 50) {
      const errorMsg = `Player ${playerIndex}: Name too long (max 50 characters) - got: "${player.name}"`;
      console.error(`Validation error: ${errorMsg}`);
      validationErrors.push(errorMsg);
      return;
    }
    
    // Enhanced Dota2 ID validation
    const trimmedDota2Id = player.dota2id ? player.dota2id.trim() : '';
    if (!trimmedDota2Id || !/^\d{6,20}$/.test(trimmedDota2Id)) {
      const errorMsg = `Player ${playerIndex}: Invalid Dota2 ID (must be 6-20 digits) - got: "${player.dota2id}"`;
      console.error(`Validation error: ${errorMsg}`);
      validationErrors.push(errorMsg);
      return;
    }
    
    // Enhanced MMR validation
    if (typeof player.mmr !== 'number' || isNaN(player.mmr) || player.mmr < 0 || player.mmr > 20000) {
      const errorMsg = `Player ${playerIndex}: Invalid MMR (must be 0-20000) - got: ${player.mmr}`;
      console.error(`Validation error: ${errorMsg}`);
      validationErrors.push(errorMsg);
      return;
    }
    
    // Enhanced notes validation
    if (player.notes && player.notes.length > 500) {
      const errorMsg = `Player ${playerIndex}: Notes too long (max 500 characters)`;
      console.error(`Validation error: ${errorMsg}`);
      validationErrors.push(errorMsg);
      return;
    }
    
    // Add validated player data
    validPlayers.push({
      name: trimmedName,
      dota2id: trimmedDota2Id,
      mmr: parseInt(player.mmr),
      notes: player.notes ? player.notes.trim() : '',
      originalIndex: playerIndex
    });
    
    console.log(`Player ${playerIndex} validation passed:`, {
      name: trimmedName,
      dota2id: trimmedDota2Id,
      mmr: parseInt(player.mmr)
    });
  });
  
  console.log(`Validation complete: ${validPlayers.length} valid, ${validationErrors.length} errors`);
  
  return { validPlayers, validationErrors };
}

// Enhanced player processing
async function processPlayers(validPlayers, existingPlayers, existingDota2Ids, skipDuplicates, updateExisting) {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const processingErrors = [];
  
  for (const player of validPlayers) {
    try {
      console.log(`Processing player:`, {
        originalName: player.name,
        originalDota2Id: player.dota2id,
        originalMmr: player.mmr
      });
      
      const playerData = {
        name: player.name,
        dota2id: player.dota2id,
        mmr: parseInt(player.mmr),
        notes: player.notes || ''
      };
      
      console.log(`Player data for database:`, playerData);
      
      const exists = existingDota2Ids.has(playerData.dota2id);
      
      if (exists) {
        if (skipDuplicates && !updateExisting) {
          console.log(`Skipping existing player: ${playerData.name} (${playerData.dota2id})`);
          skipped++;
          continue;
        }
        
        if (updateExisting) {
          // Find existing player and update
          const existingPlayer = existingPlayers.find(p => p.dota2id === playerData.dota2id);
          if (existingPlayer) {
            console.log(`Updating existing player: ${playerData.name} (${playerData.dota2id})`);
            await updateMasterlistPlayer(existingPlayer.id, playerData);
            updated++;
          } else {
            console.log(`Player not found for update: ${playerData.name} (${playerData.dota2id})`);
            skipped++;
          }
        }
      } else {
        // Add new player
        console.log(`Adding new player: ${playerData.name} (${playerData.dota2id})`);
        await addMasterlistPlayer(playerData);
        added++;
        existingDota2Ids.add(playerData.dota2id); // Add to set to prevent duplicates in same batch
      }
      
    } catch (error) {
      console.error(`Error processing player ${player.name}:`, error);
      processingErrors.push(`Failed to process ${player.name} (${player.dota2id}): ${error.message}`);
    }
  }
  
  return { added, updated, skipped, processingErrors };
} 