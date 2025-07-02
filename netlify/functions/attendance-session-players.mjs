import { sql } from './database.mjs';
import { getPlayers } from './database.mjs';

export const handler = async (event) => {
  try {
    const attendanceSessionId = event.queryStringParameters?.attendanceSessionId;
    if (!attendanceSessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Missing attendanceSessionId' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Look up the registration_session_id for this attendance session
    const result = await sql`
      SELECT registration_session_id FROM attendance_sessions WHERE session_id = ${attendanceSessionId}
    `;
    if (!result || result.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, message: 'Attendance session not found' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    const registrationSessionId = result[0].registration_session_id;

    // Fetch players for this registration session
    const players = await getPlayers(registrationSessionId);
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