import { sql } from './database.mjs';

export async function handler(event, context) {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        // Bulk update logic
        if (body.bulk === true && Array.isArray(body.playerIds) && typeof body.present === 'boolean') {
            // Update all players in the list
            const updatedPlayers = await sql`
                UPDATE players
                SET present = ${body.present}, updated_at = NOW()
                WHERE id = ANY(${body.playerIds})
                RETURNING *
            `;
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: `Bulk attendance update successful`,
                    updatedCount: updatedPlayers.length,
                    updatedPlayers
                })
            };
        }

        const { sessionId, playerName, dota2Id } = body;

        // Validate required fields
        if (!sessionId || !playerName || !dota2Id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Missing required fields: sessionId, playerName, dota2Id' 
                })
            };
        }

        // Verify attendance session exists and is active
        const attendanceSession = await sql`
            SELECT att.*, rs.session_id as registration_session_id
            FROM attendance_sessions att
            JOIN registration_sessions rs ON att.registration_session_id = rs.session_id
            WHERE att.session_id = ${sessionId} AND att.is_active = true
        `;

        if (attendanceSession.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Attendance session not found or inactive' 
                })
            };
        }

        const session = attendanceSession[0];
        const now = new Date();
        const startTime = new Date(session.start_time);
        const endTime = new Date(session.end_time);

        // Check if attendance window is open
        if (now < startTime) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Attendance session has not started yet' 
                })
            };
        }

        if (now > endTime) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Attendance session has ended' 
                })
            };
        }

        // Find player in the registration session
        const player = await sql`
            SELECT * FROM players 
            WHERE registration_session_id = ${session.registration_session_id}
            AND (LOWER(name) = LOWER(${playerName}) OR LOWER(dota2id) = LOWER(${dota2Id}))
        `;

        if (player.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Player not found in this tournament registration' 
                })
            };
        }

        const playerData = player[0];

        // Check if player is already marked present
        if (playerData.present === true) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Player already marked as present',
                    alreadyPresent: true,
                    player: playerData
                })
            };
        }

        // Update player attendance status
        const updatedPlayer = await sql`
            UPDATE players 
            SET present = true, updated_at = NOW()
            WHERE id = ${playerData.id}
            RETURNING *
        `;

        if (updatedPlayer.length === 0) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Failed to update attendance status' 
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'Attendance marked successfully',
                player: updatedPlayer[0]
            })
        };

    } catch (error) {
        console.error('Update player attendance error:', error);
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