// Registration sessions management API
import { 
  createRegistrationSession, 
  getRegistrationSessions, 
  getRegistrationSessionBySessionId,
  updateRegistrationSession, 
  deleteRegistrationSession,
  validateSession 
} from './database.js';

export const handler = async (event, context) => {
  try {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        }
      };
    }

    // Validate session
    const sessionId = event.headers['x-session-id'];
    if (!sessionId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Session ID required'
        })
      };
    }

    const sessionValidation = await validateSession(sessionId);
    if (!sessionValidation.valid) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid or expired session'
        })
      };
    }

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetSessions(event, sessionValidation);
      case 'POST':
        return await handleCreateSession(event, sessionValidation);
      case 'PUT':
        return await handleUpdateSession(event, sessionValidation);
      case 'DELETE':
        return await handleDeleteSession(event, sessionValidation);
      default:
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

  } catch (error) {
    console.error('Registration sessions API error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};

async function handleGetSessions(event, sessionValidation) {
  try {
    const urlParams = new URLSearchParams(event.queryStringParameters || {});
    const regSessionId = urlParams.get('sessionId');

    if (regSessionId) {
      // Get specific registration session
      const session = await getRegistrationSessionBySessionId(regSessionId);
      
      if (!session) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Registration session not found'
          })
        };
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          session: session
        })
      };
    } else {
      // Get all sessions for this admin (or all if super admin)
      const adminUserId = sessionValidation.role === 'superadmin' ? null : sessionValidation.userId;
      const sessions = await getRegistrationSessions(adminUserId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          sessions: sessions
        })
      };
    }
  } catch (error) {
    console.error('Error getting registration sessions:', error);
    throw error;
  }
}

async function handleCreateSession(event, sessionValidation) {
  try {
    const sessionData = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!sessionData.title) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Title is required'
        })
      };
    }

    // Validate max players
    if (sessionData.maxPlayers && (sessionData.maxPlayers < 1 || sessionData.maxPlayers > 1000)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Max players must be between 1 and 1000'
        })
      };
    }

    // Create the registration session
    const result = await createRegistrationSession(
      sessionValidation.userId,
      sessionValidation.username,
      {
        title: sessionData.title,
        description: sessionData.description,
        maxPlayers: sessionData.maxPlayers || 100,
        expiresAt: sessionData.expiresAt || null
      }
    );
    
    if (result.success) {
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Registration session created successfully',
          sessionId: result.sessionId,
                      registrationUrl: `https://dota2regz.netlify.app/register/?session=${result.sessionId}`
        })
      };
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: result.message
        })
      };
    }
  } catch (error) {
    console.error('Error creating registration session:', error);
    throw error;
  }
}

async function handleUpdateSession(event, sessionValidation) {
  try {
    const sessionData = JSON.parse(event.body || '{}');
    
    if (!sessionData.sessionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Session ID is required'
        })
      };
    }

    // Check if user owns this session (unless super admin)
    if (sessionValidation.role !== 'superadmin') {
      const session = await getRegistrationSessionBySessionId(sessionData.sessionId);
      if (!session || session.adminUserId !== sessionValidation.userId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Access denied. You can only modify your own registration sessions.'
          })
        };
      }
    }

    // Validate max players if provided
    if (sessionData.maxPlayers && (sessionData.maxPlayers < 1 || sessionData.maxPlayers > 1000)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Max players must be between 1 and 1000'
        })
      };
    }

    const result = await updateRegistrationSession(sessionData.sessionId, {
      title: sessionData.title,
      description: sessionData.description,
      maxPlayers: sessionData.maxPlayers,
      isActive: sessionData.isActive,
      expiresAt: sessionData.expiresAt
    });
    
    if (result.success) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Registration session updated successfully'
        })
      };
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: result.message
        })
      };
    }
  } catch (error) {
    console.error('Error updating registration session:', error);
    throw error;
  }
}

async function handleDeleteSession(event, sessionValidation) {
  try {
    const { sessionId: regSessionId } = JSON.parse(event.body || '{}');
    
    if (!regSessionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Session ID is required'
        })
      };
    }

    // Check if user owns this session (unless super admin)
    if (sessionValidation.role !== 'superadmin') {
      const session = await getRegistrationSessionBySessionId(regSessionId);
      if (!session || session.adminUserId !== sessionValidation.userId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Access denied. You can only delete your own registration sessions.'
          })
        };
      }
    }

    const result = await deleteRegistrationSession(regSessionId);
    
    if (result.success) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Registration session deleted successfully'
        })
      };
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: result.message
        })
      };
    }
  } catch (error) {
    console.error('Error deleting registration session:', error);
    throw error;
  }
} 