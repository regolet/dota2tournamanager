import { sql } from './database.mjs';

export async function handler(event, context) {
    console.log('🔧 Test DB function started');
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    try {
        // Test database connection
        const result = await sql`SELECT 1 as test`;
        console.log('Database test result:', result);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Database connection successful',
                test: result[0],
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Database connection error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Database connection failed',
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
} 