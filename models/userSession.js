const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  sessionToken: {
    type: String,
    unique: true,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
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
  lastActivity: {
    type: Date,
    default: Date.now
  },
  totalTests: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
userSessionSchema.index({ sessionToken: 1 });
userSessionSchema.index({ ipAddress: 1 });
userSessionSchema.index({ lastActivity: -1 });

module.exports = mongoose.model('UserSession', userSessionSchema);
