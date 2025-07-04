import { sql, validateSession } from './database.mjs';

export const handler = async (event) => {
  try {
    // 1. Validate admin session
    const sessionId = event.headers['x-session-id'] || event.headers['X-Session-Id'];
    console.log('[DEBUG] Received sessionId:', sessionId);
    if (!sessionId) {
      console.error('[DEBUG] Missing admin session header');
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'Missing admin session' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    const session = await validateSession(sessionId);
    console.log('[DEBUG] Session validation result:', session);
    if (!session.valid) {
      console.error('[DEBUG] Invalid or expired session:', session);
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
    console.log('[DEBUG] attendanceSessionId:', attendanceSessionId);
    if (!attendanceSessionId) {
      console.error('[DEBUG] Missing attendanceSessionId');
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Missing attendanceSessionId' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    const result = await sql`
      SELECT registration_session_id, admin_user_id FROM attendance_sessions WHERE session_id = ${attendanceSessionId}
    `;
    console.log('[DEBUG] Attendance session query result:', result);
    if (!result || result.length === 0) {
      console.error('[attendance-session-players] Attendance session not found for session_id:', attendanceSessionId);
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, message: 'Attendance session not found' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    const registrationSessionId = result[0].registration_session_id;
    const sessionOwnerId = result[0].admin_user_id;
    console.log('[attendance-session-players] registrationSessionId:', registrationSessionId, 'sessionOwnerId:', sessionOwnerId);

    // 3. Restrict access: only owner or superadmin can view
    if (!isSuperadmin && adminUserId !== sessionOwnerId) {
      console.error('[attendance-session-players] Access denied for adminUserId:', adminUserId, 'sessionOwnerId:', sessionOwnerId);
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, message: 'Access denied: You can only view players from your own attendance sessions' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // 4. Fetch players for this registration session
    try {
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
      console.log('[attendance-session-players] Players query result:', players);
      // Always return success: true and an array (even if empty)
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, players: Array.isArray(players) ? players : [] }),
        headers: { 'Content-Type': 'application/json' }
      };
    } catch (queryError) {
      console.error('[attendance-session-players] SQL query error:', queryError, queryError.stack);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: queryError.message, stack: queryError.stack }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
  } catch (error) {
    console.error('[attendance-session-players] Handler error:', error, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: error.message, stack: error.stack }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}; 