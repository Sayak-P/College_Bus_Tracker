const mongoose = require('mongoose');

const stoppageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    time: { type: String, required: true }
});

const driverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true }
});

const routeSchema = new mongoose.Schema({
    routeId: { type: String, required: true, unique: true },
    classTime: { type: String },
    busNumber: { type: String },
    driver: driverSchema,
    conductor: driverSchema,
    stoppages: [stoppageSchema],
    arrivalAtIter: { type: String },
    departureFromIter: { type: String }
});

module.exports = mongoose.model('Route', routeSchema);
