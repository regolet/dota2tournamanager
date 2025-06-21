// Function to handle tournament data operations (GET, POST)
import { saveTournament, getTournament, getTournaments, validateSession } from './database.js';

export async function handler(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                ...headers,
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
            body: ''
        };
    }

    try {
        const sessionId = event.headers['x-session-id'];
        if (!sessionId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: 'Invalid or expired session' }),
                headers
            };
        }

        const session = await validateSession(sessionId);
        if (!session.valid) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: 'Invalid or expired session' }),
                headers
            };
        }

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
            const tournamentId = event.queryStringParameters?.id;
            
            // If ID is provided, get a specific tournament
            if (tournamentId) {
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
            } else {
                // If no ID, get the list of all tournaments
                const tournaments = await getTournaments();
                return {
                    statusCode: 200,
                    body: JSON.stringify(tournaments),
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