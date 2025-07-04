import { sql } from './database.mjs';
import { validateSession } from './database.mjs';
import { convertPHTimeToUTC, validateTimeRange } from './validation-utils.mjs';

export async function handler(event, context) {
    console.log('🔧 Attendance sessions function started');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));
    console.log('Query parameters:', JSON.stringify(event.queryStringParameters, null, 2));
    console.log('Body:', event.body);
    console.log('Database URL present:', !!(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL));
    
    // Check if database is configured
    if (!process.env.NETLIFY_DATABASE_URL && !process.env.DATABASE_URL) {
        console.error('❌ Database environment variable is not set');
        return {
            statusCode: 503,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, x-session-id, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                message: 'Database not configured',
                error: 'Database environment variable is missing. Please configure the database connection.',
                timestamp: new Date().toISOString()
            })
        };
    }
    
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-session-id, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const { httpMethod, queryStringParameters, body } = event;
        const sessionIdParam = queryStringParameters?.sessionId;
        const adminSessionId = event.headers['x-session-id'];

        if (httpMethod === 'GET') {
            // If admin session header is present, validate and use admin logic
            if (adminSessionId) {
                console.log('🔍 Validating admin session for GET...');
                try {
                    const sessionValidation = await validateSession(adminSessionId);
                    if (!sessionValidation || !sessionValidation.valid) {
                        console.log('❌ Invalid or expired session:', sessionValidation?.reason);
                        return {
                            statusCode: 401,
                            headers,
                            body: JSON.stringify({ success: false, message: 'Invalid or expired session' })
                        };
                    }
                    console.log('✅ Session validated for user:', sessionValidation.userId);
                    if (sessionIdParam) {
                        return await getAttendanceSession(sessionIdParam, sessionValidation.userId);
                    } else {
                        return await getAttendanceSessions(sessionValidation.userId);
                    }
                } catch (sessionError) {
                    console.error('❌ Session validation error:', sessionError);
                    return {
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({ success: false, message: 'Session validation failed', error: sessionError.message })
                    };
                }
            } else {
                // Public GET access: only require sessionId in query string
                if (!sessionIdParam) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ success: false, message: 'No attendance session ID provided' })
                    };
                }
                // Public GET: do not require admin_user_id
                return await getAttendanceSessionPublic(sessionIdParam);
            }
        }

        // For all other methods, require admin session
        if (!adminSessionId) {
            console.log('❌ No session ID provided');
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'No session ID provided' })
            };
        }
        console.log('🔍 Validating session...');
        const sessionValidation = await validateSession(adminSessionId);
        if (!sessionValidation || !sessionValidation.valid) {
            console.log('❌ Invalid or expired session:', sessionValidation?.reason);
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid or expired session' })
            };
        }
        console.log('✅ Session validated for user:', sessionValidation.userId);

        switch (httpMethod) {
            case 'POST':
                return await createAttendanceSession(JSON.parse(body), sessionValidation.userId, sessionValidation.username);
            case 'PUT':
                return await updateAttendanceSession(sessionIdParam, JSON.parse(body), sessionValidation.userId);
            case 'DELETE':
                return await deleteAttendanceSession(sessionIdParam, sessionValidation.userId);
            default:
                return {
                    statusCode: 405,
                    headers,
                    body: JSON.stringify({ success: false, message: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('💥 Attendance sessions function critical error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        // Check if it's a database connection error
        if (error.message && error.message.includes('DATABASE_URL')) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Database connection error',
                    error: 'Database configuration issue',
                    timestamp: new Date().toISOString()
                })
            };
        }
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Internal server error - Attendance sessions function',
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
}

function toCamelCaseSession(session) {
    return {
        ...session,
        sessionId: session.session_id,
        adminUserId: session.admin_user_id,
        adminUsername: session.admin_username,
        registrationSessionId: session.registration_session_id,
        startTime: session.start_time,
        endTime: session.end_time,
        isActive: session.is_active,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        presentCount: session.present_count || 0,
        totalCount: session.total_count || 0,
        registrationSessionTitle: session.registration_session_title,
        registrationPlayerCount: session.registration_player_count,
    };
}

async function getAttendanceSessions(adminUserId) {
    try {
        console.log('🔍 Getting attendance sessions for admin user:', adminUserId);
        
        const sessions = await sql`
            SELECT 
                att.*,
                COALESCE(rs.title, 'Unknown') as registration_session_title,
                COALESCE(rs.player_count, 0) as registration_player_count
            FROM attendance_sessions att
            LEFT JOIN registration_sessions rs ON att.registration_session_id = rs.session_id
            WHERE att.admin_user_id = ${adminUserId}
            ORDER BY att.created_at DESC
        `;

        console.log('✅ Found', sessions.length, 'attendance sessions');
        const camelSessions = sessions.map(toCamelCaseSession);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                sessions: camelSessions 
            })
        };
    } catch (error) {
        console.error('❌ Error getting attendance sessions:', error);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        // Check for specific database errors
        if (error.message && error.message.includes('connection')) {
            return {
                statusCode: 503,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Database connection error',
                    error: 'Service temporarily unavailable',
                    timestamp: new Date().toISOString()
                })
            };
        }
        
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to get attendance sessions',
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
}

async function getAttendanceSession(sessionId, adminUserId) {
    try {
        const sessions = await sql`
            SELECT 
                att.*,
                COALESCE(rs.title, 'Unknown') as registration_session_title,
                COALESCE(rs.player_count, 0) as registration_player_count
            FROM attendance_sessions att
            LEFT JOIN registration_sessions rs ON att.registration_session_id = rs.session_id
            WHERE att.session_id = ${sessionId} AND att.admin_user_id = ${adminUserId}
        `;

        if (sessions.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Attendance session not found' 
                })
            };
        }

        const camelSession = toCamelCaseSession(sessions[0]);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                session: camelSession 
            })
        };
    } catch (error) {
        console.error('Error getting attendance session:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to get attendance session',
                error: error.message 
            })
        };
    }
}

async function createAttendanceSession(sessionData, adminUserId, adminUsername) {
    try {
        let { name, registrationSessionId, startTime, endTime, description } = sessionData;
        
        // Convert from PH time to UTC with better error handling
        if (startTime) {
            try {
                startTime = convertPHTimeToUTC(startTime);
            } catch (error) {
                console.error('Error converting start time:', error);
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        success: false, 
                        message: error.message 
                    })
                };
            }
        }
        
        if (endTime) {
            try {
                endTime = convertPHTimeToUTC(endTime);
            } catch (error) {
                console.error('Error converting end time:', error);
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        success: false, 
                        message: error.message 
                    })
                };
            }
        }
        
        // Validate that end time is after start time
        if (startTime && endTime) {
            try {
                validateTimeRange(startTime, endTime);
            } catch (error) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        success: false, 
                        message: error.message 
                    })
                };
            }
        }
        
        // Validate required fields
        if (!name || !registrationSessionId || !startTime || !endTime) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Missing required fields: name, registrationSessionId, startTime, endTime' 
                })
            };
        }

        // Generate unique session ID
        const sessionId = 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Insert attendance session
        const result = await sql`
            INSERT INTO attendance_sessions (
                session_id, admin_user_id, admin_username, name, 
                registration_session_id, start_time, end_time, description, is_active
            ) VALUES (
                ${sessionId}, ${adminUserId}, ${adminUsername}, ${name},
                ${registrationSessionId}, ${startTime}, ${endTime}, ${description || ''}, true
            ) RETURNING *
        `;

        const attendanceUrl = `${process.env.URL || 'http://localhost:8888'}/attendance/?session=${sessionId}`;

        return {
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                session: result[0],
                attendanceUrl: attendanceUrl,
                message: 'Attendance session created successfully' 
            })
        };
    } catch (error) {
        console.error('Error creating attendance session:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to create attendance session',
                error: error.message 
            })
        };
    }
}

async function updateAttendanceSession(sessionId, updates, adminUserId) {
    try {
        console.log('[UpdateAttendanceSession] sessionId:', sessionId);
        console.log('[UpdateAttendanceSession] updates:', updates);
        console.log('[UpdateAttendanceSession] adminUserId:', adminUserId);
        let { isActive, name, startTime, endTime, description } = updates;

        // Convert from PH time to UTC with better error handling
        if (startTime !== undefined) {
            try {
                startTime = convertPHTimeToUTC(startTime);
            } catch (error) {
                console.error('[UpdateAttendanceSession] Error converting start time:', error);
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        success: false, 
                        message: error.message 
                    })
                };
            }
        }
        if (endTime !== undefined) {
            try {
                endTime = convertPHTimeToUTC(endTime);
            } catch (error) {
                console.error('[UpdateAttendanceSession] Error converting end time:', error);
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        success: false, 
                        message: error.message 
                    })
                };
            }
        }

        // Check if session exists
        const existingSession = await sql`
            SELECT id FROM attendance_sessions 
            WHERE session_id = ${sessionId}
        `;
        if (existingSession.length === 0) {
            console.error('[UpdateAttendanceSession] Attendance session not found:', sessionId);
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Attendance session not found' 
                })
            };
        }

        // Perform individual updates following the pattern used in other functions
        if (name !== undefined) {
            await sql`UPDATE attendance_sessions SET name = ${name}, updated_at = NOW() WHERE session_id = ${sessionId}`;
        }
        if (startTime !== undefined) {
            await sql`UPDATE attendance_sessions SET start_time = ${startTime}, updated_at = NOW() WHERE session_id = ${sessionId}`;
        }
        if (endTime !== undefined) {
            await sql`UPDATE attendance_sessions SET end_time = ${endTime}, updated_at = NOW() WHERE session_id = ${sessionId}`;
        }
        if (description !== undefined) {
            await sql`UPDATE attendance_sessions SET description = ${description}, updated_at = NOW() WHERE session_id = ${sessionId}`;
        }
        if (isActive !== undefined) {
            const isActiveBool = isActive === true || isActive === 'true';
            await sql`UPDATE attendance_sessions SET is_active = ${isActiveBool}, updated_at = NOW() WHERE session_id = ${sessionId}`;
        }

        // Get the updated session
        const result = await sql`
            SELECT 
                att.*,
                COALESCE(rs.title, 'Unknown') as registration_session_title,
                COALESCE(rs.player_count, 0) as registration_player_count
            FROM attendance_sessions att
            LEFT JOIN registration_sessions rs ON att.registration_session_id = rs.session_id
            WHERE att.session_id = ${sessionId}
        `;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                session: toCamelCaseSession(result[0]),
                message: 'Attendance session updated successfully' 
            })
        };
    } catch (error) {
        console.error('[UpdateAttendanceSession] General Error:', error);
        console.error('Error stack:', error.stack);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to update attendance session',
                error: error.message,
                stack: error.stack
            })
        };
    }
}

async function deleteAttendanceSession(sessionId, adminUserId) {
    try {
        // Check if session exists and belongs to admin
        const existingSession = await sql`
            SELECT id FROM attendance_sessions 
            WHERE session_id = ${sessionId} AND admin_user_id = ${adminUserId}
        `;

        if (existingSession.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Attendance session not found' 
                })
            };
        }

        // Delete attendance session
        await sql`
            DELETE FROM attendance_sessions 
            WHERE session_id = ${sessionId} AND admin_user_id = ${adminUserId}
        `;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                message: 'Attendance session deleted successfully' 
            })
        };
    } catch (error) {
        console.error('Error deleting attendance session:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to delete attendance session',
                error: error.message 
            })
        };
    }
}

// Add a public version of getAttendanceSession (no admin_user_id check)
async function getAttendanceSessionPublic(sessionId) {
    try {
        const sessions = await sql`
            SELECT 
                att.*,
                COALESCE(rs.title, 'Unknown') as registration_session_title,
                COALESCE(rs.player_count, 0) as registration_player_count
            FROM attendance_sessions att
            LEFT JOIN registration_sessions rs ON att.registration_session_id = rs.session_id
            WHERE att.session_id = ${sessionId}
        `;

        if (sessions.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Attendance session not found' 
                })
            };
        }

        const camelSession = toCamelCaseSession(sessions[0]);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                session: camelSession 
            })
        };
    } catch (error) {
        console.error('Error getting attendance session (public):', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to get attendance session',
                error: error.message 
            })
        };
    }
} 