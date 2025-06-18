// Registration API function for admin panel using Neon DB
import { getRegistrationSettings, saveRegistrationSettings } from './database.js';

export const handler = async (event, context) => {
  try {
    console.log('Registration API called:', event.httpMethod, event.path);
    console.log('Query parameters:', event.queryStringParameters);
    console.log('Request body:', event.body);
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
        }
      };
    }
    
    // Get session ID for auth check (required for POST/PUT operations)
    const sessionId = event.headers['x-session-id'] || 
                     event.queryStringParameters?.sessionId;
    
    const isAuthenticated = sessionId && sessionId.length >= 10;
    
    // For non-GET operations, require authentication
    if (event.httpMethod !== 'GET' && !isAuthenticated) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Authentication required for this operation'
        })
      };
    }
    
    if (event.httpMethod === 'GET') {
      console.log('Processing GET request for registration settings...');
      
      try {
        // Get current registration settings from database
        console.log('Calling getRegistrationSettings...');
        const registrationSettings = await getRegistrationSettings();
        console.log('Retrieved registration settings from database:', registrationSettings);
        
        // Return in the format expected by frontend
        const response = {
          success: true,
          registration: {
            isOpen: registrationSettings.isOpen,
            tournamentName: registrationSettings.tournament?.name,
            tournamentDate: registrationSettings.tournament?.date,
            maxPlayers: registrationSettings.tournament?.maxPlayers,
            playerLimit: registrationSettings.tournament?.maxPlayers,
            enablePlayerLimit: true,
            expiry: registrationSettings.expiry || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: registrationSettings.createdAt || new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          },
          message: 'Registration settings retrieved successfully'
        };
        
        console.log('Returning response:', response);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(response)
        };
      } catch (dbError) {
        console.error('Database error in GET request:', dbError);
        console.error('Error stack:', dbError.stack);
        
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Database error: ' + dbError.message,
            error: dbError.toString(),
            timestamp: new Date().toISOString()
          })
        };
      }
      
    } else if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      // Handle creating/updating registration settings
      let requestBody = {};
      try {
        requestBody = JSON.parse(event.body || '{}');
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Invalid JSON in request body'
          })
        };
      }
      
      console.log('Registration settings update request:', requestBody);
      
      // Extract settings from different possible request formats
      let settings = requestBody.settings || requestBody;
      
      // Handle different action types
      if (requestBody.action === 'create') {
        // Creating new registration
        settings = requestBody.settings;
        
        if (!settings) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Registration settings are required'
            })
          };
        }
        
        // Validate required fields
        if (!settings.expiry) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Expiry date is required'
            })
          };
        }
        
        // Create registration settings object for database
        const dbSettings = {
          isOpen: true,
          tournament: {
            name: settings.tournamentName || "Dota 2 Tournament",
            date: settings.tournamentDate || new Date().toISOString().split('T')[0],
            maxPlayers: settings.playerLimit || settings.maxPlayers || 40
          },
          expiry: settings.expiry,
          createdAt: settings.createdAt || new Date().toISOString()
        };
        
        try {
          // Save to database
          await saveRegistrationSettings(dbSettings);
          
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: true,
              registration: {
                isOpen: true,
                tournamentName: dbSettings.tournament.name,
                tournamentDate: dbSettings.tournament.date,
                maxPlayers: dbSettings.tournament.maxPlayers,
                playerLimit: dbSettings.tournament.maxPlayers,
                enablePlayerLimit: true,
                expiry: settings.expiry,
                createdAt: dbSettings.createdAt,
                lastUpdated: new Date().toISOString()
              },
              message: 'Registration created successfully'
            })
          };
        } catch (dbError) {
          console.error('Database error creating registration:', dbError);
          return {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Failed to create registration: ' + dbError.message
            })
          };
        }
        
      } else if (requestBody.action === 'close' || settings.isOpen === false) {
        // Closing registration
        const dbSettings = {
          isOpen: false,
          tournament: {
            name: settings.tournamentName || "Dota 2 Tournament",
            date: settings.tournamentDate || new Date().toISOString().split('T')[0],
            maxPlayers: settings.playerLimit || settings.maxPlayers || 40
          },
          closedAt: new Date().toISOString(),
          autoClose: settings.autoClose || false
        };
        
        try {
          // Save to database
          await saveRegistrationSettings(dbSettings);
          
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: true,
              registration: {
                isOpen: false,
                tournamentName: dbSettings.tournament.name,
                tournamentDate: dbSettings.tournament.date,
                maxPlayers: dbSettings.tournament.maxPlayers,
                playerLimit: dbSettings.tournament.maxPlayers,
                enablePlayerLimit: true,
                closedAt: dbSettings.closedAt,
                autoClose: dbSettings.autoClose,
                lastUpdated: new Date().toISOString()
              },
              message: 'Registration closed successfully'
            })
          };
        } catch (dbError) {
          console.error('Database error closing registration:', dbError);
          return {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Failed to close registration: ' + dbError.message
            })
          };
        }
        
      } else {
        // Generic update
        const dbSettings = {
          isOpen: settings.isOpen !== undefined ? settings.isOpen : true,
          tournament: {
            name: settings.tournamentName || "Dota 2 Tournament",
            date: settings.tournamentDate || new Date().toISOString().split('T')[0],
            maxPlayers: settings.playerLimit || settings.maxPlayers || 40
          }
        };
        
        if (settings.expiry) dbSettings.expiry = settings.expiry;
        if (settings.createdAt) dbSettings.createdAt = settings.createdAt;
        if (settings.closedAt) dbSettings.closedAt = settings.closedAt;
        
        try {
          // Save to database
          await saveRegistrationSettings(dbSettings);
          
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: true,
              registration: {
                isOpen: dbSettings.isOpen,
                tournamentName: dbSettings.tournament.name,
                tournamentDate: dbSettings.tournament.date,
                maxPlayers: dbSettings.tournament.maxPlayers,
                playerLimit: dbSettings.tournament.maxPlayers,
                enablePlayerLimit: true,
                expiry: dbSettings.expiry,
                createdAt: dbSettings.createdAt,
                closedAt: dbSettings.closedAt,
                lastUpdated: new Date().toISOString()
              },
              message: 'Registration settings updated successfully'
            })
          };
        } catch (dbError) {
          console.error('Database error updating registration:', dbError);
          return {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              message: 'Failed to update registration: ' + dbError.message
            })
          };
        }
      }
      
    } else {
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
    console.error('Registration API error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error: ' + error.message,
        error: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
}; 