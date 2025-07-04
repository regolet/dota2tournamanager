import { banPlayer, unbanPlayer, getBannedPlayers, getBanHistory, isPlayerBanned } from './database.mjs';
import { validateAdminSession } from './security-utils.mjs';

export async function handler(event, context) {
  try {
    const { httpMethod, headers, queryStringParameters, body } = event;
    
    // Validate admin session for all operations
    const sessionValidation = await validateAdminSession(headers);
    if (!sessionValidation.valid) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized - Invalid or expired session' })
      };
    }

    const { userId, username } = sessionValidation;

    switch (httpMethod) {
      case 'GET':
        return await handleGet(queryStringParameters);
      
      case 'POST':
        return await handlePost(JSON.parse(body || '{}'), userId, username);
      
      case 'DELETE':
        return await handleDelete(queryStringParameters, userId, username);
      
      default:
        return {
          statusCode: 405,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}

async function handleGet(queryParams) {
  try {
    const { dota2id, history } = queryParams;
    
    if (dota2id) {
      if (history === 'true') {
        // Get ban history for specific player
        const banHistory = await getBanHistory(dota2id);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, data: banHistory })
        };
      } else {
        // Check if specific player is banned
        const banned = await isPlayerBanned(dota2id);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, banned })
        };
      }
    } else {
      // Get all currently banned players
      const bannedPlayers = await getBannedPlayers();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: bannedPlayers })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error retrieving ban data', details: error.message })
    };
  }
}

async function handlePost(banData, userId, username) {
  try {
    const { dota2id, playerName, reason, banType, expiresAt } = banData;
    
    if (!dota2id || !playerName || !reason) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: dota2id, playerName, and reason are required' })
      };
    }
    
    const banResult = await banPlayer({
      dota2id,
      playerName,
      reason,
      bannedBy: userId,
      bannedByUsername: username,
      banType: banType || 'permanent',
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: banResult.message })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error banning player', details: error.message })
    };
  }
}

async function handleDelete(queryParams, userId, username) {
  try {
    const { dota2id } = queryParams;
    
    if (!dota2id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Dota2 ID is required for unbanning' })
      };
    }
    
    const unbanResult = await unbanPlayer(dota2id);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: unbanResult.message })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error unbanning player', details: error.message })
    };
  }
} 