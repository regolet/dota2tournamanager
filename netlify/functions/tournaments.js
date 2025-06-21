// Function to handle tournament data operations (GET, POST)
import { saveTournament, getTournament } from './database.js';
import { validateSession } from './security-utils.js';

export async function handler(event, context) {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
            },
            body: ''
        };
    }

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
        'Content-Type': 'application/json'
    };

    const session = await validateSession(event.headers['x-session-id']);
    if (!session.valid) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Invalid or expired session' }),
            headers
        };
    }

    try {
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            const result = await saveTournament(data);
            if (result.success) {
                return {
                    statusCode: 200,
                    body: JSON.stringify(result),
                    headers
                };
            } else {
                return {
                    statusCode: 500,
                    body: JSON.stringify({ message: result.message }),
                    headers
                };
            }
        }

        if (event.httpMethod === 'GET') {
            const tournamentId = event.queryStringParameters.id;
            if (!tournamentId) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Tournament ID is required' }),
                    headers
                };
            }

            const tournament = await getTournament(tournamentId);
            if (tournament) {
                return {
                    statusCode: 200,
                    body: JSON.stringify(tournament),
                    headers
                };
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ message: 'Tournament not found' }),
                    headers
                };
            }
        }

        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
            headers
        };
    } catch (error) {
        console.error('Error in tournaments function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
            headers
        };
    }
} 