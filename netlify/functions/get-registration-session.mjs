// Public endpoint to get registration session information (no auth required)
import { getRegistrationSessionBySessionId } from './database.mjs';

export const handler = async (event, context) => {
  try {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        }
      };
    }

    // Only handle GET requests for this public endpoint
    if (event.httpMethod !== 'GET') {
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

    // Get session ID from query parameters
    const urlParams = new URLSearchParams(event.queryStringParameters || {});
    const sessionId = urlParams.get('sessionId');

    if (!sessionId) {
      return {
        statusCode: 400,
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

    // Get registration session
    const session = await getRegistrationSessionBySessionId(sessionId);
    
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

    // Return only public information (no sensitive admin data)
    const publicSessionInfo = {
      sessionId: session.sessionId,
      title: session.title,
      description: session.description,
      maxPlayers: session.maxPlayers,
      playerCount: session.playerCount,
      isActive: session.isActive,
      expiresAt: session.expiresAt,
      startTime: session.startTime,
      createdAt: session.createdAt,
      adminUsername: session.adminUsername // Safe to show organizer name
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        session: publicSessionInfo
      })
    };

  } catch (error) {
    console.error('Get registration session error:', error);
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