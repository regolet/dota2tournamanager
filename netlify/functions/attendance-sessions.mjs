import { sql } from './database.mjs';
import { validateSession } from './database.mjs';
import { DateTime } from 'luxon';

export async function handler(event, context) {
    console.log('🔧 Attendance sessions function started');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));
    
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
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
        presentCount: session.present_count,
        totalCount: session.total_count,
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
                COALESCE(rs.player_count, 0) as registration_player_count,
                COALESCE(present_stats.present_count, 0) as present_count,
                COALESCE(present_stats.total_count, 0) as total_count
            FROM attendance_sessions att
            LEFT JOIN registration_sessions rs ON att.registration_session_id = rs.session_id
            LEFT JOIN (
                SELECT 
                    rs.session_id,
                COUNT(CASE WHEN p.present = true THEN 1 END) as present_count,
                COUNT(p.id) as total_count
                FROM registration_sessions rs
            LEFT JOIN players p ON rs.session_id = p.registration_session_id
                GROUP BY rs.session_id
            ) present_stats ON att.registration_session_id = present_stats.session_id
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
                COALESCE(rs.player_count, 0) as registration_player_count,
                COALESCE(present_stats.present_count, 0) as present_count,
                COALESCE(present_stats.total_count, 0) as total_count
            FROM attendance_sessions att
            LEFT JOIN registration_sessions rs ON att.registration_session_id = rs.session_id
            LEFT JOIN (
                SELECT 
                    rs.session_id,
                COUNT(CASE WHEN p.present = true THEN 1 END) as present_count,
                COUNT(p.id) as total_count
                FROM registration_sessions rs
            LEFT JOIN players p ON rs.session_id = p.registration_session_id
                GROUP BY rs.session_id
            ) present_stats ON att.registration_session_id = present_stats.session_id
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
        // Convert from PH time to UTC
        if (startTime) {
            startTime = DateTime.fromISO(startTime, { zone: 'Asia/Manila' }).toUTC().toISO();
        }
        if (endTime) {
            endTime = DateTime.fromISO(endTime, { zone: 'Asia/Manila' }).toUTC().toISO();
        }
        
        // Validate required fields
        if (!name || !registrationSessionId || !startTime || !endTime) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Missing required fields' 
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
        let { isActive, name, startTime, endTime, description } = updates;
        // Convert from PH time to UTC
        if (startTime) {
            startTime = DateTime.fromISO(startTime, { zone: 'Asia/Manila' }).toUTC().toISO();
        }
        if (endTime) {
            endTime = DateTime.fromISO(endTime, { zone: 'Asia/Manila' }).toUTC().toISO();
        }
        
        // Check if session exists
        const existingSession = await sql`
            SELECT id FROM attendance_sessions 
            WHERE session_id = ${sessionId}
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

        // Build update query using proper parameterized queries
        let result;
        
        if (isActive !== undefined) {
            // Update is_active field
            result = await sql`
                UPDATE attendance_sessions 
                SET is_active = ${isActive === true || isActive === 'true'}, 
                    updated_at = NOW()
                WHERE session_id = ${sessionId}
                RETURNING *
            `;
        } else if (name !== undefined) {
            // Update name field
            result = await sql`
                UPDATE attendance_sessions 
                SET name = ${name}, 
                    updated_at = NOW()
                WHERE session_id = ${sessionId}
                RETURNING *
            `;
        } else if (startTime !== undefined) {
            // Update start_time field
            result = await sql`
                UPDATE attendance_sessions 
                SET start_time = ${startTime}, 
                    updated_at = NOW()
                WHERE session_id = ${sessionId}
                RETURNING *
            `;
        } else if (endTime !== undefined) {
            // Update end_time field
            result = await sql`
                UPDATE attendance_sessions 
                SET end_time = ${endTime}, 
                    updated_at = NOW()
                WHERE session_id = ${sessionId}
                RETURNING *
            `;
        } else if (description !== undefined) {
            // Update description field
            result = await sql`
                UPDATE attendance_sessions 
                SET description = ${description}, 
                    updated_at = NOW()
                WHERE session_id = ${sessionId}
                RETURNING *
            `;
        } else {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'No valid fields to update' 
                })
            };
        }

        console.log('DEBUG: updateAttendanceSession success', {
            sessionId,
            updates,
            result: result[0]
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                session: result[0],
                message: 'Attendance session updated successfully' 
            })
        };
    } catch (error) {
        console.error('Error updating attendance session:', error);
        console.error('Error stack:', error.stack);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to update attendance session',
                error: error.message 
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
                COALESCE(rs.player_count, 0) as registration_player_count,
                COALESCE(present_stats.present_count, 0) as present_count,
                COALESCE(present_stats.total_count, 0) as total_count
            FROM attendance_sessions att
            LEFT JOIN registration_sessions rs ON att.registration_session_id = rs.session_id
            LEFT JOIN (
                SELECT 
                    rs.session_id,
                COUNT(CASE WHEN p.present = true THEN 1 END) as present_count,
                COUNT(p.id) as total_count
                FROM registration_sessions rs
            LEFT JOIN players p ON rs.session_id = p.registration_session_id
                GROUP BY rs.session_id
            ) present_stats ON att.registration_session_id = present_stats.session_id
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