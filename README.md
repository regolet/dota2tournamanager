# Dota 2 Tournament Manager

A comprehensive tournament management system for Dota 2 tournaments with player registration, team balancing, and admin management features.

## Features

- **Player Registration**: Secure player registration with Dota 2 ID validation
- **Admin Panel**: Complete tournament management interface
- **Team Balancer**: Automatic team balancing based on MMR
- **Random Picker**: Random player selection tools
- **Player Master List**: Verified player database
- **Session Management**: Secure admin authentication

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: SQLite with better-sqlite3
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Authentication**: Session-based admin authentication

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Access the application**:
   - Main site: http://localhost:3001
   - Admin panel: http://localhost:3001/admin
   - Default admin password: `admin123`

## Deployment on Vercel

### Prerequisites
- GitHub repository (already set up at: https://github.com/regolet/dota2tournamanager)
- Vercel account

### Deployment Steps

1. **Connect your GitHub repository to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Select your GitHub repository: `regolet/dota2tournamanager`

2. **Configure the project**:
   - Framework Preset: **Other**
   - Root Directory: `./` (leave default)
   - Build Command: `npm install` (auto-detected)
   - Output Directory: `./` (leave default)
   - Install Command: `npm install` (auto-detected)

3. **Environment Variables** (Optional):
   Set these in your Vercel project settings:
   ```
   NODE_ENV=production
   DEFAULT_ADMIN_PASSWORD=your-secure-password
   ```

4. **Deploy**:
   - Click "Deploy"
   - Vercel will automatically build and deploy your application

### Important Notes for Vercel Deployment

⚠️ **Database Persistence**: 
- SQLite databases are ephemeral on Vercel (reset on each deployment)
- For production, consider migrating to:
  - Vercel Postgres
  - PlanetScale
  - Supabase
  - MongoDB Atlas

⚠️ **File Storage**:
- Local file storage (JSON files) will not persist
- Consider using Vercel KV or external storage for session management

### Post-Deployment Configuration

1. **Access your deployed app**: `https://your-project-name.vercel.app`
2. **Admin access**: `https://your-project-name.vercel.app/admin`
3. **Default login**: Use the admin password you set in environment variables

## Project Structure

```
tournament/
├── admin/                 # Admin panel files
│   ├── js/               # Admin JavaScript modules
│   └── *.html            # Admin HTML pages
├── db.js                 # Database configuration
├── server.js             # Main Express server
├── vercel.json           # Vercel deployment configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## API Endpoints

### Public Endpoints
- `GET /` - Main tournament page
- `POST /save-registration.php` - Player registration (legacy compatibility)

### Admin Endpoints (Authenticated)
- `POST /admin/api/login` - Admin authentication
- `GET /admin/api/players` - Get all registered players
- `POST /admin/api/players` - Add/update players
- `GET /admin/api/masterlist` - Get master list players
- `POST /admin/api/masterlist` - Manage master list

## Security Features

- Session-based authentication
- Admin password protection
- Input validation and sanitization
- CORS protection
- SQL injection prevention

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the admin panel logs for debugging information

---

**Note**: This application was designed for tournament management and includes features specific to Dota 2 player management and team balancing algorithms. 