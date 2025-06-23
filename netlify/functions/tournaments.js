// Function to handle tournament data operations (GET, POST, DELETE)
import { saveTournament, getTournament, getTournaments, validateSession, deleteTournament } from './database.js';

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
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

        const { userId: adminUserId, role: adminRole } = session;

        if (event.httpMethod === 'POST') {
            const clientData = JSON.parse(event.body);
            
            const dbPayload = {
                id: clientData.id,
                admin_user_id: adminUserId,
                team_set_id: clientData.team_set_id,
                tournament_data: clientData // Pass the entire client object as the data
            };

            const result = await saveTournament(dbPayload);

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
                // If no ID, get the list of tournaments based on user role
                const targetUserId = adminRole === 'superadmin' ? null : adminUserId;
                
                try {
                    const tournaments = await getTournaments(targetUserId);
                    
                    // Manually format the date and extract tournament name safely
                    const formattedTournaments = tournaments.map(t => {
                        let tournamentName = null;
                        let tournamentData = t.tournament_data;

                        if (tournamentData) {
                            // It might be a string if coming from some DB clients, or already an object
                            if (typeof tournamentData === 'string') {
                                try {
                                    tournamentData = JSON.parse(tournamentData);
                                } catch (e) {
                                    console.error('Error parsing tournament_data', e);
                                    tournamentData = null;
                                }
                            }
                            // Check if it's a non-null object with a name property
                            if (tournamentData && typeof tournamentData === 'object' && tournamentData.name) {
                                tournamentName = tournamentData.name;
                            }
                        }

                        let createdAt = t.created_at;
                        if (createdAt && typeof createdAt === 'string') {
                            // Convert to ISO format 'YYYY-MM-DDTHH:MM:SS.sssZ' by replacing space and adding Z
                            createdAt = new Date(createdAt.replace(' ', 'T') + 'Z');
                        }
                        
                        return {
                            id: t.id,
                            name: tournamentName,
                            created_at: createdAt && !isNaN(createdAt) ? createdAt.toISOString() : null,
                        };
                    });

                    return {
                        statusCode: 200,
                        body: JSON.stringify(formattedTournaments),
                        headers
                    };
                } catch (error) {
                    console.error('Error getting tournaments:', error);
                    return {
                        statusCode: 200,
                        body: JSON.stringify([]),
                        headers
                    };
                }
            }
        }

        if (event.httpMethod === 'DELETE') {
            const tournamentId = event.queryStringParameters?.id;
            if (!tournamentId) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Tournament ID is required' }),
                    headers
                };
            }

            // Superadmin can delete any tournament. Regular admins can only delete their own.
            if (adminRole !== 'superadmin') {
                const tournament = await getTournament(tournamentId);
                if (!tournament || tournament.admin_user_id !== adminUserId) {
                    return {
                        statusCode: 403,
                        body: JSON.stringify({ message: 'Forbidden: You do not have permission to delete this tournament.' }),
                        headers
                    };
                }
            }

            const result = await deleteTournament(tournamentId);
            if (result.success) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Tournament deleted successfully' }),
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