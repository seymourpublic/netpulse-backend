// models/userSession.js - IMPROVED VERSION
const mongoose = require('mongoose');
const crypto = require('crypto');

const userSessionSchema = new mongoose.Schema({
  sessionToken: {
    type: String,
    required: true
    // Index defined below - no duplicate
  },
  ipAddress: { 
    type: String, 
    required: true 
  },
  userAgent: {
    type: String,
    maxlength: 500
  },
  location: {
    city: String,
    country: String,
    region: String,
    lat: {
      type: Number,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      min: -180,
      max: 180
    },
    timezone: String
  },
  deviceFingerprint: {
    type: String,
    index: true
  },
  deviceInfo: {
    browser: String,
    browserVersion: String,
    os: String,
    osVersion: String,
    device: String,
    isMobile: Boolean,
    isTablet: Boolean,
    isDesktop: Boolean
  },
  lastActivity: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  totalTests: { 
    type: Number, 
    default: 0,
    min: 0
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  // Session metadata
  firstSeen: {
    type: Date,
    default: Date.now
  },
  sessionDuration: {
    type: Number, // in seconds
    default: 0
  },
  // Privacy and consent
  consentGiven: {
    type: Boolean,
    default: false
  },
  dataRetentionConsent: {
    type: Boolean,
    default: true
  },
  // Rate limiting info
  testCount: {
    lastHour: { type: Number, default: 0 },
    lastDay: { type: Number, default: 0 },
    lastResetHour: { type: Date, default: Date.now },
    lastResetDay: { type: Date, default: Date.now }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// FIXED: All indexes defined once, no duplicates
userSessionSchema.index({ sessionToken: 1 }, { unique: true });
userSessionSchema.index({ ipAddress: 1 });
userSessionSchema.index({ lastActivity: -1 });
userSessionSchema.index({ isActive: 1, lastActivity: -1 }); // Active sessions sorted by activity
userSessionSchema.index({ deviceFingerprint: 1 });
userSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // TTL: 30 days

// Compound indexes for common queries
userSessionSchema.index({ ipAddress: 1, isActive: 1 });
userSessionSchema.index({ 'location.country': 1, createdAt: -1 });

// Instance methods
userSessionSchema.methods.updateActivity = async function() {
  const now = new Date();
  const hoursSinceCreation = (now - this.createdAt) / (1000 * 60 * 60);
  
  this.lastActivity = now;
  this.sessionDuration = Math.floor((now - this.firstSeen) / 1000); // in seconds
  
  // Auto-deactivate sessions older than 24 hours of inactivity
  if (hoursSinceCreation > 24) {
    this.isActive = false;
  }
  
  return this.save();
};

userSessionSchema.methods.incrementTestCount = async function() {
  const now = new Date();
  const hourDiff = (now - this.testCount.lastResetHour) / (1000 * 60 * 60);
  const dayDiff = (now - this.testCount.lastResetDay) / (1000 * 60 * 60 * 24);
  
  // Reset hourly counter if more than 1 hour has passed
  if (hourDiff >= 1) {
    this.testCount.lastHour = 0;
    this.testCount.lastResetHour = now;
  }
  
  // Reset daily counter if more than 1 day has passed
  if (dayDiff >= 1) {
    this.testCount.lastDay = 0;
    this.testCount.lastResetDay = now;
  }
  
  this.testCount.lastHour += 1;
  this.testCount.lastDay += 1;
  this.totalTests += 1;
  this.lastActivity = now;
  
  return this.save();
};

userSessionSchema.methods.canRunTest = function(limits = { hourly: 10, daily: 50 }) {
  const now = new Date();
  const hourDiff = (now - this.testCount.lastResetHour) / (1000 * 60 * 60);
  const dayDiff = (now - this.testCount.lastResetDay) / (1000 * 60 * 60 * 24);
  
  // Reset if time windows have passed
  const currentHourlyCount = hourDiff >= 1 ? 0 : this.testCount.lastHour;
  const currentDailyCount = dayDiff >= 1 ? 0 : this.testCount.lastDay;
  
  return {
    allowed: currentHourlyCount < limits.hourly && currentDailyCount < limits.daily,
    hourlyRemaining: Math.max(0, limits.hourly - currentHourlyCount),
    dailyRemaining: Math.max(0, limits.daily - currentDailyCount),
    resetHour: new Date(this.testCount.lastResetHour.getTime() + (60 * 60 * 1000)),
    resetDay: new Date(this.testCount.lastResetDay.getTime() + (24 * 60 * 60 * 1000))
  };
};

userSessionSchema.methods.deactivate = async function() {
  this.isActive = false;
  return this.save();
};

userSessionSchema.methods.getTestHistory = async function(limit = 20) {
  const SpeedTest = mongoose.model('SpeedTest');
  return SpeedTest.find({ sessionId: this._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('downloadSpeed uploadSpeed latency qualityScore createdAt')
    .lean();
};

// Static methods
userSessionSchema.statics.createSession = async function(sessionData) {
  const {
    ipAddress,
    userAgent,
    location,
    deviceInfo,
    deviceFingerprint
  } = sessionData;
  
  // Generate secure session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  
  return this.create({
    sessionToken,
    ipAddress,
    userAgent,
    location,
    deviceInfo,
    deviceFingerprint,
    isActive: true,
    firstSeen: new Date()
  });
};

userSessionSchema.statics.findOrCreateSession = async function(sessionData) {
  const { sessionToken, ipAddress, deviceFingerprint } = sessionData;
  
  // Try to find existing session by token
  if (sessionToken) {
    const existingSession = await this.findOne({ 
      sessionToken, 
      isActive: true 
    });
    
    if (existingSession) {
      await existingSession.updateActivity();
      return existingSession;
    }
  }
  
  // Try to find by IP and device fingerprint (within last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (deviceFingerprint) {
    const recentSession = await this.findOne({
      ipAddress,
      deviceFingerprint,
      isActive: true,
      lastActivity: { $gte: oneDayAgo }
    });
    
    if (recentSession) {
      await recentSession.updateActivity();
      return recentSession;
    }
  }
  
  // Create new session
  return this.createSession(sessionData);
};

userSessionSchema.statics.cleanupInactiveSessions = async function() {
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  
  const result = await this.updateMany(
    {
      isActive: true,
      lastActivity: { $lt: cutoffDate }
    },
    {
      $set: { isActive: false }
    }
  );
  
  return result.modifiedCount;
};

userSessionSchema.statics.getActiveSessionStats = async function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const [total, active, lastHour, lastDay] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.countDocuments({ 
      isActive: true, 
      lastActivity: { $gte: oneDayAgo } 
    }),
    this.countDocuments({ 
      isActive: true, 
      lastActivity: { $gte: oneHourAgo } 
    }),
    this.countDocuments({ 
      createdAt: { $gte: oneDayAgo } 
    })
  ]);
  
  return {
    totalActive: total,
    activeLastDay: active,
    activeLastHour: lastHour,
    newLastDay: lastDay
  };
};

// Pre-save middleware
userSessionSchema.pre('save', function(next) {
  // Update session duration
  if (this.firstSeen) {
    this.sessionDuration = Math.floor((Date.now() - this.firstSeen) / 1000);
  }
  next();
});

// Virtual for session age
userSessionSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

userSessionSchema.virtual('isRecentlyActive').get(function() {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return this.lastActivity >= fifteenMinutesAgo;
});

module.exports = mongoose.model('UserSession', userSessionSchema);