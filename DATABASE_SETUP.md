# Database Setup Guide

This application requires a PostgreSQL database to function properly. The system has been migrated from JSON file storage to a real database for better performance and reliability.

## Required Environment Variables

### DATABASE_URL
The connection string for your PostgreSQL database. This should be in the format:
```
postgresql://username:password@hostname:port/database
```

## Setting Up the Database

### Option 1: Neon Database (Recommended)
1. Go to [Neon](https://neon.tech) and create a free account
2. Create a new project
3. Copy the connection string from your project dashboard
4. Set it as the `DATABASE_URL` environment variable

### Option 2: Local PostgreSQL
1. Install PostgreSQL on your local machine
2. Create a new database
3. Use the connection string: `postgresql://username:password@localhost:5432/database_name`

## Environment Variable Configuration

### For Local Development
Create a `.env` file in the project root:
```
DATABASE_URL=your_database_connection_string_here
NODE_ENV=development
```

### For Netlify Production
1. Go to your Netlify dashboard
2. Navigate to Site settings > Environment variables
3. Add `DATABASE_URL` with your database connection string

## Database Schema
The application will automatically create the required tables when it first connects to the database. The schema includes:

- `players` - Tournament participants
- `admin_users` - Admin user accounts
- `admin_sessions` - Authentication sessions
- `registration_sessions` - Tournament registration sessions
- `attendance_sessions` - Attendance tracking sessions
- `teams` - Generated team configurations
- `tournaments` - Tournament brackets
- `masterlist` - Professional player database

## Troubleshooting

### 502 Bad Gateway Error
If you see a 502 error when accessing the attendance sessions, it's likely because the `DATABASE_URL` environment variable is not set.

### Database Connection Errors
- Verify your connection string is correct
- Ensure your database is accessible from the internet (for production)
- Check that your database user has the necessary permissions

### Local Development Issues
- Make sure you have a `.env` file in the project root
- Restart the Netlify dev server after adding environment variables
- Check the console logs for detailed error messages

## Testing the Database Connection
You can test if your database is properly configured by visiting:
- Local: `http://localhost:8888/admin/api/test-db`
- Production: `https://your-site.netlify.app/admin/api/test-db`

This will return a success message if the database connection is working properly. 