import { getMasterlist, validateSession } from './database.mjs';

export const handler = async (event, context) => {
  try {
    // Validate admin session
    const sessionId = event.headers['x-session-id'];
    if (!sessionId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'No session ID provided' })
      };
    }
    const sessionValidation = await validateSession(sessionId);
    if (!sessionValidation.valid) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Invalid or expired session' })
      };
    }
    // Get all players from masterlist
    const players = await getMasterlist();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, players })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: 'Failed to get masterlist', error: error.message })
    };
  }
}; 