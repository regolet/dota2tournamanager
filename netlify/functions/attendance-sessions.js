import { sql } from './database.js';
import { validateSession } from './database.js';

export async function handler(event, context) {
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
        // Validate admin session
        const sessionId = event.headers['x-session-id'];
        if (!sessionId) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'No session ID provided' })
            };
        }

        const session = await validateSession(sessionId);
        if (!session) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid or expired session' })
            };
        }

        const { httpMethod, queryStringParameters, body } = event;
        const sessionIdParam = queryStringParameters?.sessionId;

        switch (httpMethod) {
            case 'GET':
                if (sessionIdParam) {
                    return await getAttendanceSession(sessionIdParam, session.userId);
                } else {
                    return await getAttendanceSessions(session.userId);
                }
            case 'POST':
                return await createAttendanceSession(JSON.parse(body), session.userId, session.username);
            case 'PUT':
                return await updateAttendanceSession(sessionIdParam, JSON.parse(body), session.userId);
            case 'DELETE':
                return await deleteAttendanceSession(sessionIdParam, session.userId);
            default:
                return {
                    statusCode: 405,
                    headers,
                    body: JSON.stringify({ success: false, message: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Attendance sessions error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Internal server error',
                error: error.message 
            })
        };
    }
}

async function getAttendanceSessions(adminUserId) {
    try {
        const sessions = await sql`
            SELECT 
                as.*,
                rs.title as registration_session_title,
                rs.player_count as registration_player_count,
                COUNT(CASE WHEN p.present = true THEN 1 END) as present_count,
                COUNT(p.id) as total_count
            FROM attendance_sessions as
            LEFT JOIN registration_sessions rs ON as.registration_session_id = rs.session_id
            LEFT JOIN players p ON rs.session_id = p.registration_session_id
            WHERE as.admin_user_id = ${adminUserId}
            GROUP BY as.id, rs.title, rs.player_count
            ORDER BY as.created_at DESC
        `;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                sessions: sessions 
            })
        };
    } catch (error) {
        console.error('Error getting attendance sessions:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to get attendance sessions',
                error: error.message 
            })
        };
    }
}

async function getAttendanceSession(sessionId, adminUserId) {
    try {
        const sessions = await sql`
            SELECT 
                as.*,
                rs.title as registration_session_title,
                rs.player_count as registration_player_count,
                COUNT(CASE WHEN p.present = true THEN 1 END) as present_count,
                COUNT(p.id) as total_count
            FROM attendance_sessions as
            LEFT JOIN registration_sessions rs ON as.registration_session_id = rs.session_id
            LEFT JOIN players p ON rs.session_id = p.registration_session_id
            WHERE as.session_id = ${sessionId} AND as.admin_user_id = ${adminUserId}
            GROUP BY as.id, rs.title, rs.player_count
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

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                session: sessions[0] 
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
        const { name, registrationSessionId, startTime, endTime, description } = sessionData;
        
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
        const { isActive, name, startTime, endTime, description } = updates;
        
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

        // Build update query dynamically
        const updateFields = [];
        const updateValues = [];
        
        if (isActive !== undefined) {
            updateFields.push('is_active');
            updateValues.push(isActive);
        }
        if (name !== undefined) {
            updateFields.push('name');
            updateValues.push(name);
        }
        if (startTime !== undefined) {
            updateFields.push('start_time');
            updateValues.push(startTime);
        }
        if (endTime !== undefined) {
            updateFields.push('end_time');
            updateValues.push(endTime);
        }
        if (description !== undefined) {
            updateFields.push('description');
            updateValues.push(description);
        }

        if (updateFields.length === 0) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'No valid fields to update' 
                })
            };
        }

        // Add updated_at field
        updateFields.push('updated_at');
        updateValues.push(new Date().toISOString());

        // Build dynamic SQL query
        const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        const query = `UPDATE attendance_sessions SET ${setClause} WHERE session_id = $${updateFields.length + 1} AND admin_user_id = $${updateFields.length + 2} RETURNING *`;
        
        const result = await sql.unsafe(query, ...updateValues, sessionId, adminUserId);

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