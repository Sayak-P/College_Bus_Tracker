const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    regNumber: { 
        type: String, required: true, unique: true, trim: true, uppercase: true,
        match: [/^[A-Z0-9]{5,15}$/i, 'Registration number must be valid alphanumeric']
    },
    address: { type: String, required: true, trim: true },
    email: { type: String, trim: true, sparse: true },
    googleId: { type: String, sparse: true },
    password: { type: String, required: true, minlength: 6 },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
studentSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
studentSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Student', studentSchema);
