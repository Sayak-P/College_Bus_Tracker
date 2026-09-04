const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

// Custom MongoDB sanitizer (express-mongo-sanitize v2 is incompatible with Express 5)
function sanitize(obj) {
    if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            if (key.startsWith('$') || key.includes('.')) {
                delete obj[key];
            } else {
                sanitize(obj[key]);
            }
        }
    }
    return obj;
}
function mongoSanitize() {
    return (req, res, next) => {
        if (req.body) sanitize(req.body);
        if (req.params) sanitize(req.params);
        next();
    };
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '673741953853-ldcf9bde54uiv5snch47redg4284942i.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const app = express();
const server = http.createServer(app);

// ==========================================
// ALLOWED ORIGINS FOR CORS
// ==========================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

// ==========================================
// SECURITY MIDDLEWARE (order matters)
// ==========================================

// Helmet — sets secure HTTP headers
app.use(helmet({
    contentSecurityPolicy: false, // Disabled so Leaflet, Google fonts, etc. load fine
    crossOriginOpenerPolicy: false // Allows Google Sign-In popup to communicate back with window.opener
}));

// CORS — restricted to allowed origins
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true
}));

// Parse JSON body first, then serve static files
app.use(express.json({ limit: '10kb' })); // limit body size

// MongoDB injection sanitization — strips $ and . from input
app.use(mongoSanitize());

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ==========================================
// RATE LIMITING
// ==========================================
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // max 15 auth attempts per window
    message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: { success: false, message: 'Too many requests, slow down.' }
});

app.use('/api/login', authLimiter);
app.use('/api/student/login', authLimiter);
app.use('/api/student/register', authLimiter);
app.use('/auth/google', authLimiter);
app.use('/api/', apiLimiter);

// ==========================================
// DATABASE CONNECTION
// ==========================================
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/busTracker')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const stopSchema = new mongoose.Schema({
    name: String,
    lat: Number,
    lng: Number
});
const BusStop = mongoose.model('BusStop', stopSchema);
const Route = require('./models/Route');
const Student = require('./models/Student');

// ==========================================
// SECURITY & AUTHENTICATION
// ==========================================
const JWT_SECRET = process.env.SECRET_TOKEN;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('❌ FATAL: SECRET_TOKEN is missing or too short in .env. Server will not start securely.');
    process.exit(1);
}

const driverSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    pin: { type: String, required: true }
});
const Driver = mongoose.model('Driver', driverSchema);

// Seed default driver if none exists
async function seedDriver() {
    try {
        const count = await Driver.countDocuments();
        if (count === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPin = await bcrypt.hash(process.env.DRIVER_PIN || "5555", salt);
            await Driver.create({ username: "admin", pin: hashedPin });
            console.log("✅ Seeded default driver admin");
        }
    } catch (err) {
        console.error("Error seeding driver:", err);
    }
}
seedDriver();

async function seedRoutes() {
    try {
        const count = await Route.countDocuments();
        if (count === 0) {
            const fs = require('fs');
            const routesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/routes.json'), 'utf8'));
            await Route.insertMany(routesData);
            console.log("✅ Seeded routes into MongoDB");
        }
    } catch (err) {
        console.error("Error seeding routes:", err);
    }
}
seedRoutes();

// ==========================================
// JWT AUTH MIDDLEWARE
// ==========================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
}

// ==========================================
// DRIVER AUTH
// ==========================================
app.post('/api/login', async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin || typeof pin !== 'string' || pin.length > 20) {
            return res.status(400).json({ success: false, message: 'Invalid PIN format' });
        }

        const driver = await Driver.findOne({ username: "admin" });
        if (!driver) return res.status(401).json({ success: false, message: "No driver found" });

        const isMatch = await bcrypt.compare(pin, driver.pin);
        if (!isMatch) return res.status(401).json({ success: false, message: "Invalid PIN" });

        const token = jwt.sign({ id: driver._id, role: 'driver' }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ success: true, token });
    } catch (err) {
        console.error("Driver Login Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ==========================================
// STUDENT AUTHENTICATION
// ==========================================
app.post('/api/student/register', async (req, res) => {
    try {
        const { name, regNumber, address, password } = req.body;

        if (!name || !regNumber || !address || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        if (!/^[A-Z0-9]{5,15}$/i.test(regNumber)) {
            return res.status(400).json({ success: false, message: "Valid registration number required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
        }

        const existing = await Student.findOne({ regNumber });
        if (existing) {
            return res.status(409).json({ success: false, message: "This registration number is already registered" });
        }

        const student = new Student({ name, regNumber, address, password });
        await student.save();

        const token = jwt.sign({ id: student._id, regNumber, role: 'student' }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ success: true, token, name: student.name, regNumber, address: student.address });
    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post('/api/student/login', async (req, res) => {
    try {
        const { regNumber, password } = req.body;

        if (!regNumber || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const student = await Student.findOne({ regNumber });
        if (!student) {
            return res.status(401).json({ success: false, message: "No account found. Please register first." });
        }

        const isMatch = await student.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Incorrect password" });
        }

        const token = jwt.sign({ id: student._id, regNumber, role: 'student' }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, name: student.name, regNumber: student.regNumber, address: student.address });
    } catch (err) {
        console.error("Student Login Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Google Sign-In: First time (register with reg number)
app.post('/auth/google/register', async (req, res) => {
    try {
        const { credential, regNumber, address } = req.body;

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;

        if (!regNumber || !/^[A-Z0-9]{5,15}$/i.test(regNumber)) {
            return res.status(400).json({ success: false, message: "Valid registration number required" });
        }
        if (!address) {
            return res.status(400).json({ success: false, message: "Address is required" });
        }

        const existingReg = await Student.findOne({ regNumber });
        if (existingReg) {
            return res.status(409).json({ success: false, message: "This registration number is already registered" });
        }
        const existingEmail = await Student.findOne({ email });
        if (existingEmail) {
            return res.status(409).json({ success: false, message: "This Google account is already registered" });
        }

        const student = new Student({
            name, regNumber, address, email,
            googleId: payload.sub,
            password: 'google-oauth-' + Date.now()
        });
        await student.save();

        const token = jwt.sign({ id: student._id, regNumber, role: 'student' }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ success: true, token, name, regNumber, address: student.address });
    } catch (err) {
        console.error("Google Register Error:", err);
        res.status(500).json({ success: false, message: "Google verification failed" });
    }
});

// Google Sign-In: Returning user
app.post('/auth/google/login', async (req, res) => {
    try {
        const { credential } = req.body;

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const email = payload.email;

        const student = await Student.findOne({ email });
        if (!student) {
            return res.status(404).json({ success: false, needsRegistration: true, name: payload.name, email });
        }

        const token = jwt.sign({ id: student._id, regNumber: student.regNumber, role: 'student' }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, name: student.name, regNumber: student.regNumber, address: student.address });
    } catch (err) {
        console.error("Google Login Error:", err);
        res.status(500).json({ success: false, message: "Google verification failed" });
    }
});

// ==========================================
// REST API ENDPOINTS
// ==========================================
const fs = require('fs');

app.get('/api/stops', async (req, res) => {
    try {
        const stops = await BusStop.find({});
        res.json(stops);
    } catch (err) {
        console.error("Error fetching stops:", err);
        res.status(500).json({ error: "Failed to fetch stops" });
    }
});

app.get('/api/routes', async (req, res) => {
    try {
        const routesData = await Route.find({});
        res.json(routesData);
    } catch (err) {
        console.error("Error fetching routes:", err);
        res.status(500).json({ error: "Failed to fetch routes" });
    }
});

// Health check endpoint (useful for deployment platforms)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// SOCKET.IO LOGIC
// ==========================================
const studentPickups = {};
const latestBusLocations = {};
const stopCrowdCounts = {};

io.on('connection', (socket) => {
    // 1. Student drops a pickup pin
    socket.on('set-pickup', (data) => {
        studentPickups[socket.id] = data;

        // Simplified route allocation — match by lat range
        let assignedRoute = "Cuttack - 1 (A)";
        if (data.lat > 20.32) {
            assignedRoute = "Patia 1 (A)";
        } else if (data.lat > 20.28 && data.lat <= 20.32) {
            assignedRoute = "Cuttack - 2 (A)";
        }

        Route.findOne({ routeId: assignedRoute }).then(matchedRoute => {
            let driverDetails = {};
            if (matchedRoute) {
                driverDetails = {
                    driverName: matchedRoute.driver ? matchedRoute.driver.name : "Unknown",
                    driverPhone: matchedRoute.driver ? matchedRoute.driver.phone : "",
                    conductorName: matchedRoute.conductor ? matchedRoute.conductor.name : "Unknown",
                    conductorPhone: matchedRoute.conductor ? matchedRoute.conductor.phone : "",
                    busNumber: matchedRoute.busNumber,
                    arrivalTime: matchedRoute.arrivalAtIter
                };
            }

            const stopName = data.stopName || "Unknown Stop";
            stopCrowdCounts[stopName] = (stopCrowdCounts[stopName] || 0) + 1;

            socket.emit('bus-allocated', {
                routeId: assignedRoute,
                message: `Bus Allocated: Assigned to ${assignedRoute}.`,
                crowdCount: stopCrowdCounts[stopName],
                driverDetails: driverDetails
            });

            if (latestBusLocations[assignedRoute]) {
                socket.emit('receive-location', latestBusLocations[assignedRoute]);
            }

            io.emit('crowd-update', { stopName: stopName, count: stopCrowdCounts[stopName] });
        }).catch(err => {
            console.error("Error reading route for driver details", err);
        });
    });

    // 2. Driver sends location — verify token AND validate routeId
    socket.on('send-location', (data) => {
        try {
            if (!data.token || !data.routeId || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
                throw new Error("Missing required fields");
            }

            const decoded = jwt.verify(data.token, JWT_SECRET);
            if (decoded.role !== 'driver') throw new Error("Unauthorized role");

            // Sanitize routeId — only save if it's a valid string, no special chars
            const safeRouteId = String(data.routeId).slice(0, 60);

            const locationData = {
                lat: data.lat,
                lng: data.lng,
                routeId: safeRouteId
            };

            latestBusLocations[safeRouteId] = locationData;
            io.emit('receive-location', locationData);
        } catch (err) {
            console.log(`🚨 Security: Unauthorized socket ping from ${socket.id} — ${err.message}`);
            socket.emit('auth-error', { message: 'Authentication failed. Please log in again.' });
        }
    });

    socket.on('disconnect', () => {
        const pickup = studentPickups[socket.id];
        if (pickup && pickup.stopName && stopCrowdCounts[pickup.stopName] > 0) {
            stopCrowdCounts[pickup.stopName]--;
            io.emit('crowd-update', {
                stopName: pickup.stopName,
                count: stopCrowdCounts[pickup.stopName]
            });
        }
        delete studentPickups[socket.id];
    });
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ CampusFlow server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});