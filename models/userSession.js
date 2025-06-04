const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  sessionToken: {
    type: String,
    required: true
    // REMOVED: unique: true (will be added via schema.index below)
  },
  ipAddress: { type: String, required: true },
  userAgent: String,
  location: {
    city: String,
    country: String,
    region: String,
    lat: Number,
    lng: Number,
    timezone: String
  },
  deviceFingerprint: String,
  lastActivity: { type: Date, default: Date.now },
  totalTests: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// FIXED: Indexes - only define once here
userSessionSchema.index({ sessionToken: 1 }, { unique: true }); // Define unique here
userSessionSchema.index({ ipAddress: 1 });
userSessionSchema.index({ lastActivity: -1 });

module.exports = mongoose.model('UserSession', userSessionSchema);