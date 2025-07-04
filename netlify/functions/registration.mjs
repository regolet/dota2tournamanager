// Registration API function for admin panel using Neon DB
import { getRegistrationSettings, saveRegistrationSettings } from './database.mjs';
import { 
  validateString, 
  validateSessionTitle, 
  checkRateLimit, 
  sanitizeForLogging,
  validateFutureDate
} from './validation-utils.mjs';
import { sql } from './database.mjs';

export const handler = async (event, context) => {
  try {
    // Store request info for debugging if needed
    const { httpMethod, path, queryStringParameters, body, headers } = event;
    
    // Rate limiting protection
    const clientIP = headers['x-forwarded-for'] || headers['cf-connecting-ip'] || 'unknown';
    const rateLimit = checkRateLimit(`registration-${clientIP}`, 30, 60000); // 30 requests per minute
    
    if (!rateLimit.allowed) {
      return {
        statusCode: 429,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Retry-After': rateLimit.retryAfter.toString()
        },
        body: JSON.stringify({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: rateLimit.retryAfter
        })
      };
    }

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
        // Get current registration settings from database using the helper function
        const registrationSettings = await getRegistrationSettings();
        
        const response = {
          success: true,
          registration: registrationSettings || {
            isOpen: false,
            tournament: {
              name: "Dota 2 Tournament",
              date: new Date().toISOString().split('T')[0],
              maxPlayers: 40
            },
            expiry: null,
            createdAt: null,
            closedAt: null,
            autoClose: false
          },
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
        // Return a fallback response instead of error
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            registration: {
              isOpen: false,
              tournament: {
                name: "Dota 2 Tournament",
                date: new Date().toISOString().split('T')[0],
                maxPlayers: 40
              },
              expiry: null,
              createdAt: null,
              closedAt: null,
              autoClose: false
            },
            message: 'Default registration settings (database unavailable)'
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
        try {
          // Creating new registration - get data from settings object
          const {
            expiry,
            playerLimit = 40,
            tournamentName: customTournamentName
          } = settings || {};
          
          // Validate tournament name if provided
          let tournamentName = 'Dota 2 Tournament';
          if (customTournamentName) {
            const nameValidation = validateSessionTitle(customTournamentName, false);
            if (!nameValidation.isValid) {
              return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                  success: false,
                  message: 'Invalid tournament name: ' + nameValidation.errors.join(', ')
                })
              };
            }
            tournamentName = nameValidation.value;
          }
          
          // Validate expiry date
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
          
          // Validate expiry date using utility function
          try {
            validateFutureDate(expiry);
          } catch (error) {
            return {
              statusCode: 400,
              headers: corsHeaders,
              body: JSON.stringify({
                success: false,
                message: error.message
              })
            };
          }
          
          // Validate player limit
          const numericPlayerLimit = parseInt(playerLimit, 10);
          if (isNaN(numericPlayerLimit) || numericPlayerLimit < 1 || numericPlayerLimit > 200) {
            return {
              statusCode: 400,
              headers: corsHeaders,
              body: JSON.stringify({
                success: false,
                message: 'Player limit must be between 1 and 200'
              })
            };
          }
          
          const tournamentDate = null; // Can be added later if needed
          
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
              max_players, expiry,
              created_at, updated_at
            ) VALUES (
              true, ${tournamentName}, ${tournamentDate},
              ${numericPlayerLimit}, ${expiry},
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
          
        } catch (createError) {
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Failed to create registration: ' + createError.message
            })
          };
        }
        
      } else if (action === 'close') {
        try {
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
          
        } catch (closeError) {
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Failed to close registration: ' + closeError.message
            })
          };
        }
        
      } else {
        try {
          // Generic update - get data from settings object if available
          const {
            tournamentName,
            tournamentDate,
            playerLimit,
            expiry
          } = settings || requestBody;
          
          const result = await sql`
            UPDATE registration_settings 
            SET tournament_name = COALESCE(${tournamentName}, tournament_name),
                tournament_date = COALESCE(${tournamentDate}, tournament_date),
                max_players = COALESCE(${playerLimit}, max_players),
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
          
        } catch (updateError) {
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Failed to update registration: ' + updateError.message
            })
          };
        }
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
        message: 'Internal server error: ' + error.message
      })
    };
  }
}; 