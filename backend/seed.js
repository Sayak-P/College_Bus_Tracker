require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/busTracker';

const stopSchema = new mongoose.Schema({
    name: String,
    lat: Number,
    lng: Number
});
const BusStop = mongoose.model('BusStop', stopSchema);

// Our known accurate stops
const knownStops = [
    { name: "KIIT Square", lat: 20.3548, lng: 85.8193 },
    { name: "Patia Square", lat: 20.3540, lng: 85.8160 },
    { name: "Chandrasekharpur (Damana)", lat: 20.3340, lng: 85.8190 },
    { name: "Jayadev Vihar", lat: 20.2990, lng: 85.8180 },
    { name: "Acharya Vihar", lat: 20.2940, lng: 85.8240 },
    { name: "Vani Vihar", lat: 20.2940, lng: 85.8330 },
    { name: "Rupali Square", lat: 20.2941, lng: 85.8407 },
    { name: "Master Canteen", lat: 20.2666, lng: 85.8436 },
    { name: "Raj Mahal Square", lat: 20.2605, lng: 85.8360 },
    { name: "Kalpana Square", lat: 20.2520, lng: 85.8415 },
    { name: "AG Square", lat: 20.2644, lng: 85.8335 },
    { name: "Rasulgarh Square", lat: 20.2976, lng: 85.8569 },
    { name: "Baramunda Bus Stand", lat: 20.2687, lng: 85.7925 },
    { name: "Fire Station Square", lat: 20.2766, lng: 85.8035 },
    { name: "CRPF Square", lat: 20.2870, lng: 85.8122 },
    { name: "Khandagiri Bus Stop", lat: 20.2600, lng: 85.7850 },
    { name: "ITER", lat: 20.2496, lng: 85.8002 }
];

async function seed() {
    try {
        await mongoose.connect(mongoURI);
        console.log('✅ Connected to MongoDB');

        // Extract all stops from routes.json
        const routesData = JSON.parse(fs.readFileSync('./data/routes.json', 'utf8'));
        const uniqueStops = new Set();
        routesData.forEach(route => {
            if(route.stoppages) {
                route.stoppages.forEach(stop => {
                    uniqueStops.add(stop.name.trim());
                });
            }
        });

        console.log(`Found ${uniqueStops.size} unique stops in routes.json`);

        const allStops = [];
        
        uniqueStops.forEach(stopName => {
            // Check if we have accurate coords
            const known = knownStops.find(s => s.name.toLowerCase() === stopName.toLowerCase());
            if (known) {
                allStops.push({ name: stopName, lat: known.lat, lng: known.lng });
            } else {
                // Generate a mock coordinate in Bhubaneswar/Cuttack area for now
                // Lat: ~20.25 to 20.45, Lng: ~85.75 to 85.90
                const mockLat = 20.25 + (Math.random() * 0.20);
                const mockLng = 85.75 + (Math.random() * 0.15);
                allStops.push({ name: stopName, lat: mockLat, lng: mockLng });
            }
        });

        // Add any known stops that weren't in routes.json
        knownStops.forEach(known => {
            if (!allStops.find(s => s.name.toLowerCase() === known.name.toLowerCase())) {
                allStops.push(known);
            }
        });

        // Clear existing
        await BusStop.deleteMany({});
        console.log("Cleared old stops.");

        // Insert new
        await BusStop.insertMany(allStops);
        console.log(`✅ Seeded ${allStops.length} bus stops successfully!`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Seed error:", err);
        process.exit(1);
    }
}

seed();