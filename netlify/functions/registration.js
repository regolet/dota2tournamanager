// Registration API function for admin panel
import { getRegistrationSettings } from './database.js';

export const handler = async (event, context) => {
  try {
    console.log('Registration API called:', event.httpMethod, event.path);
    console.log('Query parameters:', event.queryStringParameters);
    
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
    
    // Check if this is a status request
    const isStatusRequest = event.queryStringParameters && 
                           (event.queryStringParameters.hasOwnProperty('t') || 
                            event.path?.includes('status') || 
                            event.rawPath?.includes('status'));
    
    if (event.httpMethod === 'GET') {
      if (isStatusRequest) {
        // Return registration status
        const registrationStatus = {
          isOpen: true,
          openTime: "2025-01-18T08:00:00.000Z",
          closeTime: "2025-01-25T23:59:59.000Z",
          maxPlayers: 100,
          currentPlayers: 12,
          allowLateRegistration: true,
          requireApproval: false,
          message: "Tournament registration is currently open!",
          lastUpdated: new Date().toISOString()
        };
        
        console.log('Returning registration status:', registrationStatus);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            success: true,
            status: registrationStatus,
            message: 'Registration status retrieved successfully'
          })
        };
      } else {
        // Return registration settings from database
        const registrationSettings = await getRegistrationSettings();
        
        console.log('Returning registration settings from database');
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            settings: {
              isOpen: registrationSettings.is_open,
              tournamentName: registrationSettings.tournament_name,
              tournamentDate: registrationSettings.tournament_date,
              maxPlayers: registrationSettings.max_players,
              playerLimit: registrationSettings.max_players,
              expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
              enablePlayerLimit: true
            },
            message: 'Registration settings retrieved successfully'
          })
        };
      }
      
    } else if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      // Handle updating registration settings
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
      
      // Mock successful update
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Registration settings updated successfully',
          updatedSettings: {
            ...requestBody,
            lastModified: new Date().toISOString()
          }
        })
      };
      
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