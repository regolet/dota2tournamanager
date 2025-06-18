// Registration API function for admin panel using Neon DB
import { getRegistrationSettings, saveRegistrationSettings } from './database.js';
import { neon } from '@netlify/neon';

// Initialize Neon database connection
const sql = neon();

export const handler = async (event, context) => {
  try {
    // Store request info for debugging if needed
    const { httpMethod, path, queryStringParameters, body, headers } = event;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-session-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };

    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    // Get session ID for auth check (required for POST/PUT operations)
    const sessionId = headers['x-session-id'] || headers['X-Session-ID'];
    
    const isAuthenticated = sessionId && sessionId.length >= 10;
    
    // For non-GET operations, require authentication
    if (httpMethod !== 'GET' && !isAuthenticated) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Authentication required for this operation'
        })
      };
    }
    
    if (httpMethod === 'GET') {
      try {
        // Get current registration settings from database
        const registrationSettings = await getRegistrationSettings();
        
        if (!registrationSettings) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'No registration settings found'
            })
          };
        }

        const response = {
          success: true,
          registration: registrationSettings,
          message: 'Registration settings retrieved successfully'
        };
        
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(response)
        };
      } catch (dbError) {
        console.error('Database error in GET request:', dbError);
        console.error('Error stack:', dbError.stack);
        
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Database error retrieving registration settings'
          })
        };
      }
      
    } else if (httpMethod === 'POST' || httpMethod === 'PUT') {
      // Handle creating/updating registration settings
      let requestBody = {};
      try {
        requestBody = JSON.parse(body || '{}');
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Invalid JSON in request body'
          })
        };
      }
      
      // Handle different action types
      const { action, settings } = requestBody;

      if (action === 'create') {
        // Creating new registration - get data from settings object
        const {
          expiry,
          playerLimit = 40,
          enablePlayerLimit = true
        } = settings || {};
        
        const tournamentName = 'Dota 2 Tournament';
        const tournamentDate = null; // Can be added later if needed
        
        if (!expiry) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Expiry date and time are required'
            })
          };
        }
        
        // Close any existing registration first
        await sql`
          UPDATE registration_settings 
          SET is_open = false, 
              closed_at = NOW(),
              updated_at = NOW()
          WHERE is_open = true
        `;
        
        // Create new registration
        const result = await sql`
          INSERT INTO registration_settings (
            is_open, tournament_name, tournament_date, 
            max_players, enable_player_limit, expiry,
            created_at, updated_at
          ) VALUES (
            true, ${tournamentName}, ${tournamentDate},
            ${playerLimit}, ${enablePlayerLimit}, ${expiry},
            NOW(), NOW()
          )
          RETURNING *
        `;
        
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: 'Registration created successfully',
            registration: result[0]
          })
        };
        
      } else if (action === 'close') {
        // Closing registration
        const result = await sql`
          UPDATE registration_settings 
          SET is_open = false, 
              closed_at = NOW(),
              updated_at = NOW()
          WHERE is_open = true
          RETURNING *
        `;
        
        if (result.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'No open registration found to close'
            })
          };
        }
        
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: 'Registration closed successfully',
            registration: result[0]
          })
        };
        
      } else {
        // Generic update - get data from settings object if available
        const {
          tournamentName,
          tournamentDate,
          playerLimit,
          enablePlayerLimit,
          expiry
        } = settings || requestBody;
        
        const result = await sql`
          UPDATE registration_settings 
          SET tournament_name = COALESCE(${tournamentName}, tournament_name),
              tournament_date = COALESCE(${tournamentDate}, tournament_date),
              max_players = COALESCE(${playerLimit}, max_players),
              enable_player_limit = COALESCE(${enablePlayerLimit}, enable_player_limit),
              expiry = COALESCE(${expiry}, expiry),
              updated_at = NOW()
          WHERE is_open = true
          RETURNING *
        `;
        
        if (result.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'No open registration found to update'
            })
          };
        }
        
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: 'Registration updated successfully',
            registration: result[0]
          })
        };
      }
      
    } else {
      return {
        statusCode: 405,
        headers: corsHeaders,
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-session-id',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error'
      })
    };
  }
}; 