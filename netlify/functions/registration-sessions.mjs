// Registration sessions management API
import { 
  createRegistrationSession, 
  getRegistrationSessions, 
  getRegistrationSessionBySessionId,
  updateRegistrationSession, 
  deleteRegistrationSession,
  validateSession 
} from './database.mjs';
import { getSecurityHeaders } from './security-utils.mjs';

export async function handler(event, context) {
  const headers = getSecurityHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: ''
    };
  }

  // Special handling for public GET requests (viewing tournaments)
  if (event.httpMethod === 'GET' && !event.headers['x-session-id']) {
    return await handlePublicGet(event, headers);
  }

  // For all other requests, require authentication
  try {
    const sessionValidation = await validateSession(event.headers['x-session-id']);
    
    if (!sessionValidation.valid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired session' })
      };
    }

    const { role: adminRole, userId: adminUserId, username: adminUsername } = sessionValidation;

    switch (event.httpMethod) {
      case 'GET':
        return await handleGet(event, adminRole, adminUserId, headers);
      case 'POST':
        return await handlePost(event, adminUserId, adminUsername, headers);
      case 'PUT':
        return await handlePut(event, adminRole, adminUserId, headers);
      case 'DELETE':
        return await handleDelete(event, adminRole, headers);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
    };
  }
}

async function handlePublicGet(event, headers) {
  try {
    // Get all registration sessions (public view)
    const allSessions = await getRegistrationSessions(null); // null means get all sessions
    
    // Filter to only show active sessions for public viewing
    const activeSessions = allSessions.filter(session => session.isActive);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sessions: activeSessions })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
    };
  }
}

async function handleGet(event, adminRole, adminUserId, headers) {
  const { sessionId } = event.queryStringParameters || {};
  
  if (sessionId) {
    const session = await getRegistrationSessionBySessionId(sessionId);
    if (session) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, session })
      };
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, message: 'Session not found' })
      };
    }
  } else {
    // Superadmin gets all sessions, regular admins get only their own
    const targetUserId = adminRole === 'superadmin' ? null : adminUserId;
    
    const sessions = await getRegistrationSessions(targetUserId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sessions })
    };
  }
}

async function handlePost(event, adminUserId, adminUsername, headers) {
    const data = JSON.parse(event.body);
    const result = await createRegistrationSession(adminUserId, adminUsername, data);
    
    if (result.success) {
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify(result)
        };
    } else {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: result.message })
        };
    }
}

async function handlePut(event, adminRole, adminUserId, headers) {
    const { sessionId } = event.queryStringParameters || {};
    const updates = JSON.parse(event.body);
    
    if (!sessionId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Session ID is required' }) };
    }

    // Ownership check for non-superadmins
    if (adminRole !== 'superadmin') {
        const sessionToUpdate = await getRegistrationSessionBySessionId(sessionId);
        if (!sessionToUpdate || sessionToUpdate.adminUserId !== adminUserId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Forbidden: You can only modify your own registration sessions.' })
            };
        }
    }

    const result = await updateRegistrationSession(sessionId, updates);
    if (result.success) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Session updated' }) };
    } else {
        return { statusCode: 500, headers, body: JSON.stringify({ error: result.message }) };
    }
}

async function handleDelete(event, adminRole, headers) {
  if (adminRole !== 'superadmin') {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Forbidden: You do not have permission to delete this resource.' })
    };
  }

  const { sessionId } = event.queryStringParameters || {};
  
  if (!sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Session ID is required for deletion' })
    };
  }

  const result = await deleteRegistrationSession(sessionId);
  
  if (result.success) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Registration session deleted successfully' })
    };
  } else {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: result.message || 'Failed to delete registration session' })
    };
  }
} 