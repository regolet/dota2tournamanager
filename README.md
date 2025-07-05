# Dota 2 Tournament Manager - Serverless Edition

A modern, serverless tournament management system for Dota 2 tournaments. Built with vanilla JavaScript and deployed on Netlify with JSON-based data persistence.

## 🚀 Features

- **Player Registration**: Public registration form for tournament participants
- **Admin Panel**: Complete management interface for tournament administrators
- **Team Balancer**: Automatic team balancing based on MMR ratings
- **Player List Management**: Add, edit, delete players with persistent storage
- **Masterlist**: Professional player database for reference
- **Random Picker**: Tournament bracket and random selection tools
- **Responsive Design**: Works on desktop and mobile devices

## 🛠 Architecture

- **Frontend**: Vanilla JavaScript, HTML5, CSS3, Bootstrap 5
- **Backend**: Netlify Functions (Node.js serverless)
- **Database**: JSON file-based persistence 
- **Deployment**: Netlify (serverless hosting)
- **Authentication**: Session-based admin authentication

## 📁 Project Structure

```
├── netlify/
│   └── functions/          # Serverless functions
│       ├── database.js     # JSON database module
│       ├── login.js        # Admin authentication
│       ├── check-session.js # Session validation
│       ├── get-players.js  # Player data retrieval
│       ├── save-players.js # Player management
│       ├── api-players.js  # Public player API
│       ├── masterlist.js   # Professional players
│       └── registration.js # Tournament settings
├── admin/                  # Admin panel interface
│   ├── js/                # Admin JavaScript modules
│   ├── login.html         # Admin login page
│   ├── index.html         # Admin dashboard
│   ├── player-list.html   # Player management
│   ├── team-balancer.html # Team balancing
│   ├── masterlist.html    # Professional players
│   └── registration.html  # Tournament settings
├── index.html             # Public registration page
├── style.css              # Main stylesheet
├── script.js              # Public page JavaScript
├── netlify.toml           # Netlify configuration
└── package.json           # Dependencies

```

## 🗄️ Data Storage

The system uses JSON files for data persistence:

- **players.json**: Tournament participant data
- **masterlist.json**: Professional player database
- **registration-settings.json**: Tournament configuration
- **admin-sessions.json**: Authentication sessions

Data is stored in Netlify's filesystem during function execution, providing persistence across requests while maintaining serverless architecture.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Netlify CLI (optional for local development)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/regolet/dota2tournamanager.git
   cd dota2tournamanager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run locally with Netlify Dev**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Public page: http://localhost:8888
   - Admin panel: http://localhost:8888/admin
   - Default admin password: `admin123`

### Production Deployment

1. **Deploy to Netlify**
   ```bash
   npm run deploy
   ```

2. **Or connect your GitHub repository to Netlify for automatic deployments**

## 🔧 Configuration

### Admin Authentication

Default admin credentials:
- Username: `admin`
- Password: `admin123`

Change the password through the admin panel after first login.

### Tournament Settings

Configure tournament details in the Registration tab of the admin panel:
- Tournament name and description
- Registration deadlines
- Prize pool information
- Player limits

## 📱 Usage

### For Tournament Participants

1. Visit the public registration page
2. Fill in your details (Name, Dota 2 ID, Peak MMR)
3. Submit registration
4. Check your email for confirmation

### For Tournament Administrators

1. Access `/admin` and login
2. **Player List**: Manage registered players
3. **Team Balancer**: Create balanced teams based on MMR
4. **Masterlist**: Reference professional player database
5. **Registration**: Configure tournament settings
6. **Random Picker**: Generate brackets and random selections

## 🛡️ Security Features

- Session-based authentication
- CORS protection
- Input validation and sanitization
- SQL injection prevention (using JSON storage)
- XSS protection

## 🌐 API Endpoints

### Public APIs
- `GET /api/players` - Get tournament players for team balancer
- `POST /api/add-player` - Register new player
- `GET /api/registration/status` - Get tournament info

### Admin APIs (Authenticated)
- `POST /admin/api/login` - Admin authentication
- `GET /admin/api/check-session` - Session validation
- `GET /admin/api/players` - Get all player data
- `POST /admin/save-players` - Player management operations
- `GET /admin/api/masterlist` - Professional player database

## 🔄 Data Flow

1. **Registration**: Public form → `api-players.js` → JSON storage
2. **Team Balancer**: Frontend → `api-players.js` → JSON data → Balancing algorithm
3. **Admin Management**: Admin panel → Authenticated APIs → JSON storage
4. **Persistence**: JSON files maintain state across serverless function calls

## 📊 Performance

- **Cold start**: ~200-500ms (Netlify Functions)
- **Warm requests**: ~50-100ms
- **Data persistence**: File-based JSON storage
- **Scalability**: Serverless auto-scaling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the admin panel help sections

## 🎮 Dota 2 Integration

The system integrates with Dota 2 player data:
- MMR tracking and validation
- Professional player database
- Team balancing algorithms
- Tournament bracket generation

---

**Live Demo**: [maplescurse.netlify.app](https://maplescurse.netlify.app)

**Admin Panel**: [maplescurse.netlify.app/admin](https://maplescurse.netlify.app/admin)

## Database Schema Initialization

After deploying or when making schema changes, run the Netlify function `/init-db` (or use the `init-db.mjs` script) to set up or migrate the database schema. This avoids unnecessary schema checks on every API call and improves performance.

- In development, you can call this endpoint manually or via a browser/curl.
- In production, only run this when you deploy new features that require schema changes.

**Do NOT call `initializeDatabase()` on every function invocation in production.** 