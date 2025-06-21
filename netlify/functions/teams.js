// Teams API endpoint for managing saved team configurations
import { 
  saveTeamConfiguration, 
  getTeamConfigurations, 
  getTeamConfigurationById,
  updateTeamConfiguration,
  deleteTeamConfiguration,
  validateSession 
} from './database.js';

export async function handler(event, context) {
  console.log('Teams API called:', event.httpMethod, event.path);

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Validate session for all operations
    const sessionId = event.headers.authorization?.replace('Bearer ', '');
    if (!sessionId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No session token provided' })
      };
    }

    const sessionValidation = await validateSession(sessionId);
    if (!sessionValidation.valid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired session' })
      };
    }

    const adminUserId = sessionValidation.session.user_id;
    const adminUsername = sessionValidation.user?.username || 'Unknown';

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGet(event, adminUserId, headers);
      
      case 'POST':
        return await handlePost(event, adminUserId, adminUsername, headers);
      
      case 'PUT':
        return await handlePut(event, headers);
      
      case 'DELETE':
        return await handleDelete(event, headers);
      
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

  } catch (error) {
    console.error('Teams API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
}

async function handleGet(event, adminUserId, headers) {
  const { teamSetId } = event.queryStringParameters || {};
  
  if (teamSetId) {
    // Get specific team configuration
    const teamConfig = await getTeamConfigurationById(teamSetId);
    if (!teamConfig) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Team configuration not found' })
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(teamConfig)
    };
  } else {
    // Get all team configurations for this admin
    const teamConfigs = await getTeamConfigurations(adminUserId);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(teamConfigs)
    };
  }
}

async function handlePost(event, adminUserId, adminUsername, headers) {
  const teamData = JSON.parse(event.body);
  
  // Validate required fields
  if (!teamData.title || !teamData.teams || !Array.isArray(teamData.teams)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields: title, teams' })
    };
  }

  // Calculate team statistics
  const totalTeams = teamData.teams.length;
  const totalPlayers = teamData.teams.reduce((sum, team) => sum + team.players.length, 0);
  const allMmrs = teamData.teams.flatMap(team => team.players.map(p => p.peakmmr || 0));
  const averageMmr = allMmrs.length > 0 ? Math.round(allMmrs.reduce((sum, mmr) => sum + mmr, 0) / allMmrs.length) : 0;

  const teamConfigData = {
    title: teamData.title,
    description: teamData.description || '',
    balanceMethod: teamData.balanceMethod || 'highRanked',
    totalTeams,
    totalPlayers,
    averageMmr,
    registrationSessionId: teamData.registrationSessionId || null,
    teams: teamData.teams
  };

  const result = await saveTeamConfiguration(adminUserId, adminUsername, teamConfigData);
  
  if (result.success) {
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        success: true, 
        teamSetId: result.teamSetId,
        message: 'Team configuration saved successfully' 
      })
    };
  } else {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: result.message })
    };
  }
}

async function handlePut(event, headers) {
  const { teamSetId } = event.queryStringParameters || {};
  const updates = JSON.parse(event.body);
  
  if (!teamSetId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Team set ID is required' })
    };
  }

  const result = await updateTeamConfiguration(teamSetId, updates);
  
  if (result.success) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Team configuration updated successfully' 
      })
    };
  } else {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: result.message })
    };
  }
}

async function handleDelete(event, headers) {
  const { teamSetId } = event.queryStringParameters || {};
  
  if (!teamSetId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Team set ID is required' })
    };
  }

  const result = await deleteTeamConfiguration(teamSetId);
  
  if (result.success) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Team configuration deleted successfully' 
      })
    };
  } else {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: result.message })
    };
  }
} 