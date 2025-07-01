import { getDiscordWebhooks, setDiscordWebhook, deleteDiscordWebhook, validateSession } from './database.js';
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
    // Validate session
    const sessionId = event.headers['x-session-id'] || event.headers['X-Session-Id'];
    if (!sessionId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No session token provided' })
      };
    }
    const session = await validateSession(sessionId);
    if (!session.valid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired session' })
      };
    }
    const adminUserId = session.userId;

    switch (event.httpMethod) {
      case 'GET': {
        const webhooks = await getDiscordWebhooks(adminUserId);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, webhooks })
        };
      }
      case 'POST': {
        const { type, url, template } = JSON.parse(event.body || '{}');
        if (!type || !url) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing type or url' })
          };
        }
        await setDiscordWebhook(adminUserId, type, url, template);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }
      case 'DELETE': {
        const { type } = JSON.parse(event.body || '{}');
        if (!type) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing type' })
          };
        }
        await deleteDiscordWebhook(adminUserId, type);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Discord Webhooks API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
} 