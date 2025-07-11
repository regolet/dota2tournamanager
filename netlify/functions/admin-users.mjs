// Admin user management API
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, validateSession } from './database.mjs';

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

    // Only admins and super admins can manage users
    if (!['admin', 'superadmin'].includes(sessionValidation.role)) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Access denied. Admin privileges required.'
        })
      };
    }

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetUsers(event);
      case 'POST':
        return await handleCreateUser(event);
      case 'PUT':
        return await handleUpdateUser(event);
      case 'DELETE':
        return await handleDeleteUser(event);
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
    console.error('Admin users API error:', error);
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

async function handleGetUsers(event) {
  try {
    const urlParams = new URLSearchParams(event.queryStringParameters || {});
    const userId = urlParams.get('userId');

    if (userId) {
      // Get specific user
      const users = await getAdminUsers();
      const user = users.find(u => u.id === userId);
      
      if (!user) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'User not found'
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
          user: user
        })
      };
    } else {
      // Get all users
      const users = await getAdminUsers();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          users: users
        })
      };
    }
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
}

async function handleCreateUser(event) {
  try {
    const userData = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!userData.username || !userData.password || !userData.role) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Username, password, and role are required'
        })
      };
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(userData.username)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Username must be 3-50 characters and contain only letters, numbers, and underscores'
        })
      };
    }

    // Validate password length
    if (userData.password.length < 6) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Password must be at least 6 characters long'
        })
      };
    }

    // Validate role
    if (!['admin', 'superadmin', 'moderator', 'viewer'].includes(userData.role)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Role must be one of: admin, superadmin, moderator, viewer'
        })
      };
    }

    const result = await createAdminUser(userData);
    
    if (result.success) {
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'User created successfully',
          userId: result.userId
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
    console.error('Error creating user:', error);
    throw error;
  }
}

async function handleUpdateUser(event) {
  try {
    const userData = JSON.parse(event.body || '{}');
    
    if (!userData.userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'User ID is required'
        })
      };
    }

    // Validate username format if provided
    if (userData.username && !/^[a-zA-Z0-9_]{3,50}$/.test(userData.username)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Username must be 3-50 characters and contain only letters, numbers, and underscores'
        })
      };
    }

    // Validate password length if provided
    if (userData.password && userData.password.length < 6) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Password must be at least 6 characters long'
        })
      };
    }

    // Validate role if provided
    if (userData.role && !['admin', 'superadmin', 'moderator', 'viewer'].includes(userData.role)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Role must be one of: admin, superadmin, moderator, viewer'
        })
      };
    }

    const result = await updateAdminUser(userData.userId, userData);
    
    if (result.success) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'User updated successfully'
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
    console.error('Error updating user:', error);
    throw error;
  }
}

async function handleDeleteUser(event) {
  try {
    const { userId } = JSON.parse(event.body || '{}');
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'User ID is required'
        })
      };
    }

    const result = await deleteAdminUser(userId);
    
    if (result.success) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'User deleted successfully'
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
    console.error('Error deleting user:', error);
    throw error;
  }
} 