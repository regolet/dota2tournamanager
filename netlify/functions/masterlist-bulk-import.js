// Masterlist bulk import function using Neon DB
import { getMasterlist, addMasterlistPlayer, updateMasterlistPlayer } from './database.js';

export const handler = async (event, context) => {
  try {
    console.log('RAW BODY:', event.body); // Debug: log the raw request body
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
    
    // Validate each player and filter out invalid ones
    const validPlayers = [];
    const validationErrors = [];
    players.forEach((player, index) => {
      // Debug logging
      console.log(`Validating player ${index + 1}:`, {
        name: player.name,
        nameType: typeof player.name,
        nameLength: player.name ? player.name.length : 'null',
        nameTrimmed: player.name ? player.name.trim() : 'null',
        nameTrimmedLength: player.name ? player.name.trim().length : 'null'
      });
      
      // More robust name validation - trim first, then validate
      const trimmedName = player.name ? player.name.trim() : '';
      if (!trimmedName || trimmedName.length < 2) {
        validationErrors.push(`Player ${index + 1}: Invalid name (must be at least 2 characters) - got: "${player.name}"`);
        return;
      }
      
      // More robust Dota2 ID validation
      const trimmedDota2Id = player.dota2id ? player.dota2id.trim() : '';
      if (!trimmedDota2Id || !/^\d+$/.test(trimmedDota2Id)) {
        validationErrors.push(`Player ${index + 1}: Invalid Dota2 ID (must be numeric) - got: "${player.dota2id}"`);
        return;
      }
      
      // More robust MMR validation
      if (typeof player.mmr !== 'number' || isNaN(player.mmr) || player.mmr < 0 || player.mmr > 20000) {
        validationErrors.push(`Player ${index + 1}: Invalid MMR (must be 0-20000) - got: ${player.mmr}`);
        return;
      }
      
      // Add trimmed and validated player data
      validPlayers.push({
        name: trimmedName,
        dota2id: trimmedDota2Id,
        mmr: parseInt(player.mmr),
        notes: player.notes || ''
      });
    });
    const skippedInvalid = players.length - validPlayers.length;
    
    // Always process valid players, never fail the whole batch
    // Get existing players for duplicate checking
    const existingPlayers = await getMasterlist();
    const existingDota2Ids = new Set(existingPlayers.map(p => p.dota2id));
    
    // Process players
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    
    for (const player of validPlayers) {
      try {
        // Debug logging for player processing
        console.log(`Processing player:`, {
          originalName: player.name,
          originalDota2Id: player.dota2id,
          originalMmr: player.mmr
        });
        
        const playerData = {
          name: player.name, // Already trimmed in validation
          dota2id: player.dota2id, // Already trimmed in validation
          mmr: parseInt(player.mmr),
          notes: player.notes || ''
        };
        
        console.log(`Player data for database:`, playerData);
        
        const exists = existingDota2Ids.has(playerData.dota2id);
        
        if (exists) {
          if (skipDuplicates && !updateExisting) {
            skipped++;
            continue;
          }
          
          if (updateExisting) {
            // Find existing player and update
            const existingPlayer = existingPlayers.find(p => p.dota2id === playerData.dota2id);
            if (existingPlayer) {
              await updateMasterlistPlayer(existingPlayer.id, playerData);
              updated++;
            } else {
              skipped++;
            }
          }
        } else {
          // Add new player
          await addMasterlistPlayer(playerData);
          added++;
          existingDota2Ids.add(playerData.dota2id); // Add to set to prevent duplicates in same batch
        }
        
      } catch (error) {
        console.error(`Error processing player ${player.name}:`, error);
        errors.push(`Failed to process ${player.name}: ${error.message}`);
      }
    }
    
    console.log(`Bulk import completed: ${added} added, ${updated} updated, ${skipped} skipped, ${skippedInvalid} invalid`);
    
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
        skippedInvalid: skippedInvalid,
        errors: errors.concat(validationErrors),
        total: players.length,
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