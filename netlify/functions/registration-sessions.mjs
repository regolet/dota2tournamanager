// Registration sessions management API
import { 
  createRegistrationSession, 
  getRegistrationSessions, 
  getRegistrationSessionBySessionId,
  updateRegistrationSession, 
  deleteRegistrationSession,
  validateSession 
} from './database.js';
import { getSecurityHeaders } from './security-utils.js';

export async function handler(event, context) {
  const headers = getSecurityHeaders(event);

  console.log('📡 Registration-sessions API called:', {
    method: event.httpMethod,
    path: event.path,
    queryParams: event.queryStringParameters,
    hasSessionHeader: !!event.headers['x-session-id'],
    sessionId: event.headers['x-session-id'] ? `${event.headers['x-session-id'].substring(0, 10)}...` : 'null'
  });

  if (event.httpMethod === 'OPTIONS') {
    console.log('📡 Registration-sessions: Handling OPTIONS request');
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
    console.log('📡 Registration-sessions: Public GET request - allowing access to view tournaments');
    return await handlePublicGet(event, headers);
  }

  // For all other requests, require authentication
  try {
    console.log('🔐 Registration-sessions: Validating session...');
    const sessionValidation = await validateSession(event.headers['x-session-id']);
    console.log('🔐 Registration-sessions: Session validation result:', {
      valid: sessionValidation.valid,
      reason: sessionValidation.reason,
      role: sessionValidation.role,
      userId: sessionValidation.userId ? `${sessionValidation.userId.substring(0, 10)}...` : 'null'
    });
    
    if (!sessionValidation.valid) {
      console.error('❌ Registration-sessions: Invalid session:', sessionValidation);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired session' })
      };
    }

    const { role: adminRole, userId: adminUserId, username: adminUsername } = sessionValidation;
    console.log('✅ Registration-sessions: Session validated, proceeding with request:', {
      role: adminRole,
      userId: adminUserId ? `${adminUserId.substring(0, 10)}...` : 'null',
      username: adminUsername
    });

    switch (event.httpMethod) {
      case 'GET':
        console.log('📡 Registration-sessions: Handling authenticated GET request');
        return await handleGet(event, adminRole, adminUserId, headers);
      case 'POST':
        console.log('📡 Registration-sessions: Handling POST request');
        return await handlePost(event, adminUserId, adminUsername, headers);
      case 'PUT':
        console.log('📡 Registration-sessions: Handling PUT request');
        return await handlePut(event, adminRole, adminUserId, headers);
      case 'DELETE':
        console.log('📡 Registration-sessions: Handling DELETE request');
        return await handleDelete(event, adminRole, headers);
      default:
        console.error('❌ Registration-sessions: Method not allowed:', event.httpMethod);
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
  } catch (error) {
    console.error('❌ Registration-sessions: Error in handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
    };
  }
}

async function handlePublicGet(event, headers) {
  console.log('📡 Registration-sessions: Handling public GET request for active tournaments');
  
  try {
    // Get all registration sessions (public view)
    const allSessions = await getRegistrationSessions(null); // null means get all sessions
    
    // Filter to only show active sessions for public viewing
    const activeSessions = allSessions.filter(session => session.isActive);
    
    console.log('📡 Registration-sessions: Public sessions result:', {
      totalCount: allSessions.length,
      activeCount: activeSessions.length
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sessions: activeSessions })
    };
  } catch (error) {
    console.error('❌ Registration-sessions: Error in public GET:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
    };
  }
}

async function handleGet(event, adminRole, adminUserId, headers) {
  const { sessionId } = event.queryStringParameters || {};
  
  console.log('📡 Registration-sessions handleGet:', {
    hasSessionId: !!sessionId,
    sessionId: sessionId ? `${sessionId.substring(0, 10)}...` : 'null',
    adminRole: adminRole,
    adminUserId: adminUserId ? `${adminUserId.substring(0, 10)}...` : 'null'
  });
  
  if (sessionId) {
    console.log('📡 Registration-sessions: Getting specific session by ID');
    const session = await getRegistrationSessionBySessionId(sessionId);
    console.log('📡 Registration-sessions: Specific session result:', {
      found: !!session,
      sessionId: sessionId
    });
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
    console.log(`📡 Registration-sessions: Getting sessions for ${adminRole}. Target User ID: ${targetUserId || 'all'}`);
    
    const sessions = await getRegistrationSessions(targetUserId);
    
    console.log('📡 Registration-sessions: All sessions result:', {
      count: sessions.length,
      adminUserId: targetUserId ? `${targetUserId.substring(0, 10)}...` : 'all'
    });
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