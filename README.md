# 🚌 CampusFlow — Live Bus Tracking System

Real-time campus bus tracking for **ITER Campus, Bhubaneswar**. Students can track their bus live on a map; drivers broadcast their GPS location via a secure dashboard.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JS, Leaflet.js |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Real-time | Socket.io |
| Auth | Google OAuth 2.0, JWT, bcrypt |

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- Node.js >= 18
- MongoDB running locally on port 27017

### 1. Clone & Install
```bash
git clone <repo-url>
cd "Bus Tracker/backend"
npm install
```

### 2. Configure Environment
Copy the example env and fill in your values:
```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/busTracker
DRIVER_PIN=your-secure-pin
SECRET_TOKEN=your-64-char-random-string
GOOGLE_CLIENT_ID=your-google-client-id
NODE_ENV=development
```

> **Generate a strong SECRET_TOKEN:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 3. Seed the Database
```bash
npm run seed         # Seeds bus stops (safe, checks first)
npm run seed:force   # Re-seeds even if data exists
```

### 4. Start the Server
```bash
npm run dev    # Development (auto-restarts on changes)
npm start      # Production
```

Open **http://localhost:3000** in your browser.

---

## 🚀 Production Deployment

### Environment Variables to Change
```
NODE_ENV=production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/busTracker
ALLOWED_ORIGINS=https://your-domain.com
SECRET_TOKEN=<64-char random string>
DRIVER_PIN=<strong PIN, not 5555>
```

### Deploy with PM2 (recommended)
```bash
npm install -g pm2
pm2 start server.js --name campusflow
pm2 save
pm2 startup   # Auto-restart on system reboot
```

### Deployment Platforms
- **Railway** — connect GitHub repo, set env vars in dashboard
- **Render** — free tier, set `npm start` as start command
- **VPS (Ubuntu)** — use PM2 + nginx as reverse proxy

---

## 📁 Project Structure

```
Bus Tracker/
├── backend/
│   ├── data/
│   │   └── routes.json          # Route data
│   ├── models/
│   │   ├── Route.js             # Route schema
│   │   └── Student.js           # Student schema with bcrypt
│   ├── .env                     # Environment variables (NOT committed)
│   ├── package.json
│   ├── seed.js                  # DB seeder for bus stops
│   └── server.js                # Main Express + Socket.io server
│
└── frontend/
    ├── driver/
    │   ├── driver.html          # Driver broadcast map
    │   ├── driver-dashboard.html
    │   └── driver-summary.html
    ├── student/
    │   ├── student.html         # Live tracking map
    │   ├── routes.html
    │   ├── nearby.html
    │   └── arrivals.html
    ├── config.js                # API URL config (auto-detects prod/dev)
    ├── shared.css               # Design system / shared styles
    └── index.html               # Landing page + login
```

---

## 🔐 Security Features

- Passwords hashed with **bcrypt** (salt rounds: 10)
- JWT tokens with **12h** (driver) / **24h** (student) expiry
- **Rate limiting** on all auth endpoints (15 attempts / 15 min)
- **Helmet.js** — secure HTTP headers
- **express-mongo-sanitize** — NoSQL injection protection
- **CORS** restricted to allowed origins (set via `ALLOWED_ORIGINS` env var)
- Driver pages require valid token — unauthorized access redirects to landing

---

## 🌐 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/login` | None | Driver PIN login |
| POST | `/api/student/login` | None | Student password login |
| POST | `/api/student/register` | None | Student registration |
| POST | `/auth/google/login` | None | Google OAuth login |
| POST | `/auth/google/register` | None | Google OAuth registration |
| GET | `/api/stops` | None | Get all bus stops |
| GET | `/api/routes` | None | Get all routes |
| GET | `/api/health` | None | Health check |

---

## 📡 Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `set-pickup` | Client → Server | Student sets pickup stop |
| `bus-allocated` | Server → Client | Route assigned to student |
| `send-location` | Client → Server | Driver broadcasts GPS |
| `receive-location` | Server → All | Live bus position update |
| `crowd-update` | Server → All | Crowd count at stops |
| `auth-error` | Server → Client | Token validation failed |

---

## 👥 Default Accounts

| Role | Credential | Notes |
|---|---|---|
| Driver | PIN set in `DRIVER_PIN` env var | Change from default before deployment |
| Student | Google account + reg number | First login requires registration |

---

## 📋 Deployment Checklist

- [ ] Change `SECRET_TOKEN` to 64-char random string
- [ ] Change `DRIVER_PIN` from default to a strong PIN
- [ ] Set `ALLOWED_ORIGINS` to your deployed domain
- [ ] Set `MONGO_URI` to production MongoDB Atlas connection
- [ ] Set `NODE_ENV=production`
- [ ] Run `npm run seed` once on production DB
- [ ] Set up PM2 for process management
- [ ] Add Google OAuth domain to allowed origins in Google Cloud Console

---

*Built for ITER Campus — © 2026 CampusFlow*
