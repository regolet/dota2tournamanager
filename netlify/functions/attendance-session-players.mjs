import { sql, validateSession } from './database.mjs';

export const handler = async (event) => {
  try {
    // 1. Validate admin session
    const sessionId = event.headers['x-session-id'] || event.headers['X-Session-Id'];
    if (!sessionId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'Missing admin session' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    const session = await validateSession(sessionId);
    if (!session.valid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'Invalid or expired session' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    const isSuperadmin = session.role === 'superadmin';
    const adminUserId = session.user.id;

    // 2. Get attendance session and check ownership
    const attendanceSessionId = event.queryStringParameters?.attendanceSessionId;
    if (!attendanceSessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Missing attendanceSessionId' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    const result = await sql`
      SELECT registration_session_id, admin_user_id FROM attendance_sessions WHERE session_id = ${attendanceSessionId}
    `;
    if (!result || result.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, message: 'Attendance session not found' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    const registrationSessionId = result[0].registration_session_id;
    const sessionOwnerId = result[0].admin_user_id;

    // 3. Restrict access: only owner or superadmin can view
    if (!isSuperadmin && adminUserId !== sessionOwnerId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, message: 'Access denied: You can only view players from your own attendance sessions' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // 4. Fetch players for this registration session
    const players = await sql`
      SELECT 
        p.id, 
        p.name, 
        p.dota2id, 
        p.peakmmr, 
        p.ip_address as "ipAddress", 
        p.registration_date as "registrationDate",
        p.registration_session_id as "registrationSessionId",
        rs.title as "registrationSessionTitle",
        p.discordid,
        p.present
      FROM players p
      LEFT JOIN registration_sessions rs ON p.registration_session_id = rs.session_id
      WHERE p.registration_session_id = ${registrationSessionId}
      ORDER BY p.registration_date DESC
    `;
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, players }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: error.message }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}; 