const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware to serve your HTML files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- LOGIC: Handle Socket Connections ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a driver sends their location
    socket.on('send-location', (data) => {
        // Broadcast this location to ALL connected students
        // data contains: { lat, lng, routeId }
        io.emit('receive-location', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// This tells the server: "Use the cloud provider's port, or 3000 if running locally"
const PORT = process.env.PORT || 3000; 
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});