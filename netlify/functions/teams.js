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
  console.log('Headers:', JSON.stringify(event.headers, null, 2));

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
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
    const sessionId = event.headers.authorization?.replace('Bearer ', '') || 
                     event.headers['x-session-id'] || 
                     event.headers['X-Session-Id'];
                     
    console.log('Session ID extracted:', sessionId ? 'Present' : 'Missing');
    
    if (!sessionId) {
      console.log('No session token provided');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No session token provided' })
      };
    }

    console.log('Validating session...');
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
    
    console.log('Session validation result:', sessionValidation.valid);
    
    if (!sessionValidation.valid) {
      console.log('Invalid session:', sessionValidation.message);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired session' })
      };
    }

    const adminUserId = sessionValidation.session?.user_id;
    const adminUsername = sessionValidation.user?.username || 'Unknown';
    
    if (!adminUserId) {
      console.error('No admin user ID in session:', sessionValidation);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid session structure' })
      };
    }
    
    console.log('Admin user:', adminUserId, adminUsername);

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

async function handleGet(event, adminUserId, headers) {
  console.log('HandleGet called with adminUserId:', adminUserId);
  
  try {
    const { teamSetId } = event.queryStringParameters || {};
    console.log('Query parameters:', event.queryStringParameters);
    
    if (teamSetId) {
      console.log('Getting specific team configuration:', teamSetId);
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
      console.log('Getting all team configurations for admin:', adminUserId);
      // Get all team configurations for this admin
      try {
        const teamConfigs = await getTeamConfigurations(adminUserId);
        console.log('Retrieved team configurations:', teamConfigs.length);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(teamConfigs)
        };
      } catch (dbError) {
        console.error('Database error in getTeamConfigurations:', dbError);
        // If it's a table not found error, return empty array
        if (dbError.message && (dbError.message.includes('relation "teams" does not exist') || 
                               dbError.message.includes('table') || 
                               dbError.message.includes('does not exist'))) {
          console.log('Teams table does not exist yet - returning empty array');
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify([])
          };
        }
        throw dbError; // Re-throw other database errors
      }
    }
  } catch (error) {
    console.error('HandleGet error:', error);
    console.error('HandleGet error stack:', error.stack);
    
    // If it's a database table error, return empty array instead of failing
    if (error.message && (error.message.includes('relation "teams" does not exist') || 
                         error.message.includes('table') || 
                         error.message.includes('does not exist'))) {
      console.log('Teams table does not exist yet - returning empty array');
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
    console.log('HandlePost called for admin:', adminUserId, adminUsername);
    console.log('Request body:', event.body);
    
    const teamData = JSON.parse(event.body);
    console.log('Parsed team data:', JSON.stringify(teamData, null, 2));
    
    // Validate required fields
    if (!teamData.title || !teamData.teams || !Array.isArray(teamData.teams)) {
      console.log('Validation failed - missing required fields');
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

    console.log('Team statistics calculated:', { totalTeams, totalPlayers, averageMmr });

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

    console.log('Calling saveTeamConfiguration...');
    const result = await saveTeamConfiguration(adminUserId, adminUsername, teamConfigData);
    console.log('SaveTeamConfiguration result:', result);
    
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
      console.log('SaveTeamConfiguration failed:', result.message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: result.message })
      };
    }
  } catch (error) {
    console.error('HandlePost error:', error);
    console.error('HandlePost error stack:', error.stack);
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