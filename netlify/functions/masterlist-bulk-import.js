// Simple Masterlist bulk import function
import { getMasterlist, addMasterlistPlayer, updateMasterlistPlayer } from './database.js';

export const handler = async (event, context) => {
  try {
    console.log('Bulk import started');
    
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
    
    const isAuthenticated = sessionId && sessionId.length >= 10;
    
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
    
    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    const { players, skipDuplicates = true, updateExisting = false } = requestBody;
    
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
    
    // Validate players
    const validationResults = validatePlayers(players);
    const { validPlayers, validationErrors } = validationResults;
    
    console.log(`Validation complete: ${validPlayers.length} valid, ${validationErrors.length} errors`);
    
    // If there are validation errors, return them
    if (validationErrors.length > 0) {
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
    const existingPlayers = await getMasterlist();
    const existingDota2Ids = new Set(existingPlayers.map(p => p.dota2id));
    
    // Process players
    const processResults = await processPlayers(validPlayers, existingPlayers, existingDota2Ids, skipDuplicates, updateExisting);
    
    const { added, updated, skipped, processingErrors } = processResults;
    
    console.log(`Bulk import completed: ${added} added, ${updated} updated, ${skipped} skipped`);
    
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
    console.error('Bulk import API error:', error);
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

// Validate players
function validatePlayers(players) {
  const validPlayers = [];
  const validationErrors = [];
  
  players.forEach((player, index) => {
    const playerIndex = index + 1;
    
    // Name validation
    const trimmedName = player.name ? player.name.trim() : '';
    if (!trimmedName || trimmedName.length < 2) {
      validationErrors.push(`Player ${playerIndex}: Invalid name (must be at least 2 characters) - got: "${player.name}"`);
      return;
    }
    
    if (trimmedName.length > 50) {
      validationErrors.push(`Player ${playerIndex}: Name too long (max 50 characters) - got: "${player.name}"`);
      return;
    }
    
    // Dota2 ID validation
    const trimmedDota2Id = player.dota2id ? player.dota2id.trim() : '';
    if (!trimmedDota2Id || !/^\d{6,20}$/.test(trimmedDota2Id)) {
      validationErrors.push(`Player ${playerIndex}: Invalid Dota2 ID (must be 6-20 digits) - got: "${player.dota2id}"`);
      return;
    }
    
    // MMR validation
    if (typeof player.mmr !== 'number' || isNaN(player.mmr) || player.mmr < 0 || player.mmr > 20000) {
      validationErrors.push(`Player ${playerIndex}: Invalid MMR (must be 0-20000) - got: ${player.mmr}`);
      return;
    }
    
    // Notes validation
    if (player.notes && player.notes.length > 500) {
      validationErrors.push(`Player ${playerIndex}: Notes too long (max 500 characters)`);
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
  });
  
  return { validPlayers, validationErrors };
}

// Process players
async function processPlayers(validPlayers, existingPlayers, existingDota2Ids, skipDuplicates, updateExisting) {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const processingErrors = [];
  
  for (const player of validPlayers) {
    try {
      const playerData = {
        name: player.name,
        dota2id: player.dota2id,
        mmr: parseInt(player.mmr),
        notes: player.notes || ''
      };
      
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