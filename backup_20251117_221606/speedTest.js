// models/speedTest.js - IMPROVED VERSION
const mongoose = require('mongoose');

const speedTestSchema = new mongoose.Schema({
  // Core test results
  downloadSpeed: { 
    type: Number, 
    required: true, 
    min: 0,
    get: v => Math.round(v * 100) / 100 // Round to 2 decimals
  },
  uploadSpeed: { 
    type: Number, 
    required: true, 
    min: 0,
    get: v => Math.round(v * 100) / 100
  },
  latency: { 
    type: Number, 
    required: true, 
    min: 0,
    get: v => Math.round(v * 100) / 100
  },
  jitter: { 
    type: Number, 
    required: true, 
    min: 0,
    get: v => Math.round(v * 100) / 100
  },
  packetLoss: { 
    type: Number, 
    required: true, 
    default: 0, 
    min: 0, 
    max: 100,
    get: v => Math.round(v * 100) / 100
  },
  
  // Test metadata
  testDuration: { 
    type: Number, 
    required: true,
    min: 0
  },
  ipAddress: { 
    type: String, 
    required: true 
  },
  userAgent: {
    type: String,
    maxlength: 500
  },
  
  // Device information
  deviceInfo: {
    cpu: String,
    memory: String,
    os: String,
    cores: Number,
    platform: String,
    screenResolution: String
  },
  
  // Network information
  networkType: { 
    type: String, 
    enum: ['wifi', 'ethernet', 'mobile', '4g', '5g', 'unknown'], 
    default: 'unknown',
    index: true
  },
  connectionType: {
    type: String,
    enum: ['fiber', 'cable', 'dsl', 'mobile', 'satellite', 'unknown'],
    default: 'unknown'
  },
  
  // Location information
  location: {
    city: String,
    country: {
      type: String,
      index: true
    },
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
    timezone: String,
    isp: String // Detected ISP name
  },
  
  // Test server information
  testServerId: {
    type: String,
    index: true
  },
  serverLocation: {
    city: String,
    country: String,
    distance: Number // Distance to server in km
  },
  
  // FIXED: Optimized raw results storage - store as simple arrays of numbers
  rawResults: {
    downloadSamples: {
      type: [Number],
      default: []
    },
    uploadSamples: {
      type: [Number],
      default: []
    },
    latencySamples: {
      type: [Number],
      default: []
    },
    // Simplified comprehensive data
    metadata: {
      serverId: String,
      duration: Number,
      stages: Number,
      reliability: Number,
      testId: String
    }
  },
  
  // Quality metrics
  qualityScore: { 
    type: Number, 
    min: 0, 
    max: 100,
    index: true,
    get: v => Math.round(v * 100) / 100
  },
  qualityGrade: {
    type: String,
    enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'],
    default: 'F'
  },
  
  // Consistency metrics
  downloadConsistency: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  uploadConsistency: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // References
  ispId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ISP',
    index: true
  },
  sessionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'UserSession',
    index: true
  },
  serverNodeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ServerNode' 
  },
  
  // Additional flags
  isValid: {
    type: Boolean,
    default: true,
    index: true
  },
  isSuspicious: {
    type: Boolean,
    default: false,
    index: true
  },
  validationNotes: String
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// FIXED: Comprehensive indexes - no duplicates, optimized for common queries
// Single field indexes
speedTestSchema.index({ createdAt: -1 }); // Most recent tests
speedTestSchema.index({ ispId: 1 });
speedTestSchema.index({ sessionId: 1 });
speedTestSchema.index({ qualityScore: -1 }); // High quality tests
speedTestSchema.index({ networkType: 1 });
speedTestSchema.index({ 'location.country': 1 });

// Compound indexes for complex queries
speedTestSchema.index({ ispId: 1, createdAt: -1 }); // ISP test history
speedTestSchema.index({ sessionId: 1, createdAt: -1 }); // User test history
speedTestSchema.index({ 'location.country': 1, createdAt: -1 }); // Country test history
speedTestSchema.index({ 'location.country': 1, ispId: 1, createdAt: -1 }); // Country + ISP
speedTestSchema.index({ qualityScore: -1, createdAt: -1 }); // Best tests
speedTestSchema.index({ networkType: 1, createdAt: -1 }); // Network type analysis
speedTestSchema.index({ isValid: 1, isSuspicious: 1, createdAt: -1 }); // Valid tests only
speedTestSchema.index({ testServerId: 1, createdAt: -1 }); // Server performance

// TTL index - automatically delete tests older than 90 days
speedTestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Geospatial index for location-based queries
speedTestSchema.index({ 'location.lat': 1, 'location.lng': 1 });

// Instance methods
speedTestSchema.methods.calculateQualityMetrics = function() {
  const weights = {
    download: 0.35,
    upload: 0.25,
    latency: 0.25,
    packetLoss: 0.10,
    jitter: 0.05
  };

  // Scoring functions (0-100 scale)
  const downloadScore = Math.min(100, (this.downloadSpeed / 100) * 100);
  const uploadScore = Math.min(100, (this.uploadSpeed / 50) * 100);
  const latencyScore = Math.max(0, 100 - this.latency);
  const packetLossScore = Math.max(0, 100 - (this.packetLoss * 10));
  const jitterScore = Math.max(0, 100 - (this.jitter * 2));

  const overallScore = (
    downloadScore * weights.download +
    uploadScore * weights.upload +
    latencyScore * weights.latency +
    packetLossScore * weights.packetLoss +
    jitterScore * weights.jitter
  );

  this.qualityScore = Math.round(overallScore * 100) / 100;
  this.qualityGrade = this.getQualityGrade(this.qualityScore);
  
  return {
    score: this.qualityScore,
    grade: this.qualityGrade,
    breakdown: {
      download: Math.round(downloadScore * 100) / 100,
      upload: Math.round(uploadScore * 100) / 100,
      latency: Math.round(latencyScore * 100) / 100,
      packetLoss: Math.round(packetLossScore * 100) / 100,
      jitter: Math.round(jitterScore * 100) / 100
    }
  };
};

speedTestSchema.methods.getQualityGrade = function(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
};

speedTestSchema.methods.validateTest = function() {
  // Flag suspicious results
  const suspiciousConditions = [
    this.downloadSpeed > 10000, // > 10 Gbps
    this.uploadSpeed > 5000, // > 5 Gbps
    this.latency < 0.1 || this.latency > 1000,
    this.packetLoss > 50,
    this.jitter > 500
  ];
  
  this.isSuspicious = suspiciousConditions.some(condition => condition);
  
  // Mark as invalid if critical metrics are missing or impossible
  if (this.downloadSpeed <= 0 || this.uploadSpeed <= 0 || this.latency <= 0) {
    this.isValid = false;
    this.validationNotes = 'Invalid test results: missing or zero values';
  }
  
  if (this.isSuspicious) {
    this.validationNotes = 'Flagged as suspicious: unusually high or low values';
  }
  
  return this.isValid && !this.isSuspicious;
};

// Static methods
speedTestSchema.statics.getAveragesByISP = async function(ispId, timeframe = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframe);
  
  const results = await this.aggregate([
    {
      $match: {
        ispId: mongoose.Types.ObjectId(ispId),
        createdAt: { $gte: cutoffDate },
        isValid: true,
        isSuspicious: false
      }
    },
    {
      $group: {
        _id: null,
        avgDownload: { $avg: '$downloadSpeed' },
        avgUpload: { $avg: '$uploadSpeed' },
        avgLatency: { $avg: '$latency' },
        avgJitter: { $avg: '$jitter' },
        avgPacketLoss: { $avg: '$packetLoss' },
        avgQuality: { $avg: '$qualityScore' },
        totalTests: { $sum: 1 }
      }
    }
  ]);
  
  return results[0] || null;
};

speedTestSchema.statics.getRecentTests = async function(filters = {}, limit = 20) {
  const query = {
    isValid: true,
    isSuspicious: false,
    ...filters
  };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('ispId', 'name displayName')
    .select('-rawResults') // Exclude raw results for performance
    .lean();
};

speedTestSchema.statics.getTestStatsByCountry = async function(country, days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        'location.country': country,
        createdAt: { $gte: cutoffDate },
        isValid: true,
        isSuspicious: false
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        avgDownload: { $avg: '$downloadSpeed' },
        avgUpload: { $avg: '$uploadSpeed' },
        avgLatency: { $avg: '$latency' },
        avgQuality: { $avg: '$qualityScore' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);
};

// Pre-save middleware
speedTestSchema.pre('save', function(next) {
  // Calculate quality metrics if not set
  if (!this.qualityScore) {
    this.calculateQualityMetrics();
  }
  
  // Validate test results
  this.validateTest();
  
  next();
});

// Post-save middleware - update ISP statistics
speedTestSchema.post('save', async function(doc) {
  if (doc.ispId && doc.isValid && !doc.isSuspicious) {
    const ISP = mongoose.model('ISP');
    const isp = await ISP.findById(doc.ispId);
    
    if (isp) {
      await isp.updateStatistics({
        downloadSpeed: doc.downloadSpeed,
        uploadSpeed: doc.uploadSpeed,
        latency: doc.latency,
        jitter: doc.jitter,
        packetLoss: doc.packetLoss
      });
    }
  }
});

// Virtual for test age
speedTestSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

module.exports = mongoose.model('SpeedTest', speedTestSchema);