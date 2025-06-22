// Teams API endpoint for managing saved team configurations
import { 
  saveTeamConfiguration, 
  getTeamConfigurations, 
  getTeamConfigurationById,
  updateTeamConfiguration,
  deleteTeamConfiguration,
  validateSession 
} from './database.js';
import { getSecurityHeaders } from './security-utils.js';

export async function handler(event, context) {
  const headers = getSecurityHeaders();

  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  try {
    // Validate session for all operations
    const sessionId = event.headers.authorization?.replace('Bearer ', '') || 
                     event.headers['x-session-id'] || 
                     event.headers['X-Session-Id'];
                     
    if (!sessionId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No session token provided' })
      };
    }

    let sessionValidation;
    try {
      sessionValidation = await validateSession(sessionId);
    } catch (sessionError) {
      console.error('Session validation error:', sessionError);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Session validation failed' })
      };
    }
    
    if (!sessionValidation.valid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired session' })
      };
    }

    const adminUserId = sessionValidation.userId;
    const adminUsername = sessionValidation.username || 'Unknown';
    const adminRole = sessionValidation.role || 'admin';
    
    if (!adminUserId) {
      console.error('No admin user ID in session:', sessionValidation);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid session structure' })
      };
    }
    
    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGet(event, adminUserId, adminRole, headers);
      
      case 'POST':
        return await handlePost(event, adminUserId, adminUsername, headers);
      
      case 'PUT':
        return await handlePut(event, headers);
      
      case 'DELETE':
        return await handleDelete(event, adminRole, adminUserId, headers);
      
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

  } catch (error) {
    console.error('Teams API error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
}

async function handleGet(event, adminUserId, adminRole, headers) {
  try {
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
      // Superadmin gets all, regular admins get only their own
      const targetUserId = adminRole === 'superadmin' ? null : adminUserId;
      const teamConfigs = await getTeamConfigurations(targetUserId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(teamConfigs)
      };
    }
  } catch (error) {
    // If it's a database table error, return empty array instead of failing
    if (error.message && (error.message.includes('relation "teams" does not exist') || 
                         error.message.includes('table') || 
                         error.message.includes('does not exist'))) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([])
      };
    }
    
    throw error; // Re-throw other errors to be caught by main handler
  }
}

async function handlePost(event, adminUserId, adminUsername, headers) {
  try {
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
        body: JSON.stringify({ error: result.message || 'Failed to save team configuration due to an unknown error.' })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to process team save request',
        details: error.message
      })
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

async function handleDelete(event, adminRole, adminUserId, headers) {
  try {
    const { teamSetId } = event.queryStringParameters || {};
    
    if (!teamSetId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing teamSetId parameter' })
      };
    }

    // Superadmins can delete any team set.
    // Regular admins can only delete their own.
    if (adminRole !== 'superadmin') {
      const teamConfig = await getTeamConfigurationById(teamSetId);
      if (!teamConfig || teamConfig.adminUserId !== adminUserId) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Forbidden: You do not have permission to delete this team configuration.' })
        };
      }
    }

    const result = await deleteTeamConfiguration(teamSetId);

    if (result.success) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Team configuration deleted successfully' })
      };
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: result.message || 'Failed to delete team configuration' })
      };
    }
  } catch (error) {
    console.error('Error in handleDelete for teams:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error while deleting team configuration.' })
    };
  }
} 