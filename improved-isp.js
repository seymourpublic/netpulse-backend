// models/isp.js - IMPROVED VERSION
const mongoose = require('mongoose');

const ispSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  displayName: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    required: true,
    uppercase: true,
    maxlength: 2 // ISO country code
  },
  region: {
    type: String,
    trim: true
  },
  asn: {
    type: Number,
    sparse: true,
    min: 1,
    max: 4294967295 // Max ASN value
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Website must be a valid URL'
    }
  },
  supportContact: {
    type: String,
    trim: true
  },
  statistics: {
    averageDownload: { 
      type: Number, 
      default: 0,
      min: 0,
      get: v => Math.round(v * 100) / 100 // Round to 2 decimals
    },
    averageUpload: { 
      type: Number, 
      default: 0,
      min: 0,
      get: v => Math.round(v * 100) / 100
    },
    averageLatency: { 
      type: Number, 
      default: 0,
      min: 0,
      get: v => Math.round(v * 100) / 100
    },
    reliabilityScore: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 100,
      get: v => Math.round(v * 100) / 100
    },
    totalTests: { 
      type: Number, 
      default: 0,
      min: 0
    },
    // Additional useful statistics
    averageJitter: {
      type: Number,
      default: 0,
      min: 0
    },
    averagePacketLoss: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  metadata: { 
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// FIXED: All indexes defined once, no duplicates
// Compound indexes for common queries
ispSchema.index({ country: 1, isActive: 1 }); // Most common query
ispSchema.index({ country: 1, 'statistics.averageDownload': -1 }); // Rankings by download
ispSchema.index({ country: 1, 'statistics.reliabilityScore': -1 }); // Rankings by reliability
ispSchema.index({ 'statistics.averageDownload': -1 }); // Global rankings
ispSchema.index({ 'statistics.reliabilityScore': -1 }); // Reliability rankings
ispSchema.index({ asn: 1 }, { unique: true, sparse: true }); // ASN lookup (sparse allows nulls)
ispSchema.index({ lastUpdated: -1 }); // Recently updated ISPs

// Text index for search functionality
ispSchema.index({ name: 'text', displayName: 'text' });

// Instance methods
ispSchema.methods.updateStatistics = async function(newTestData) {
  const { downloadSpeed, uploadSpeed, latency, jitter, packetLoss } = newTestData;
  
  const currentTotal = this.statistics.totalTests;
  const newTotal = currentTotal + 1;
  
  // Calculate new running averages
  this.statistics.averageDownload = 
    ((this.statistics.averageDownload * currentTotal) + downloadSpeed) / newTotal;
  
  this.statistics.averageUpload = 
    ((this.statistics.averageUpload * currentTotal) + uploadSpeed) / newTotal;
  
  this.statistics.averageLatency = 
    ((this.statistics.averageLatency * currentTotal) + latency) / newTotal;
  
  if (jitter !== undefined) {
    this.statistics.averageJitter = 
      ((this.statistics.averageJitter * currentTotal) + jitter) / newTotal;
  }
  
  if (packetLoss !== undefined) {
    this.statistics.averagePacketLoss = 
      ((this.statistics.averagePacketLoss * currentTotal) + packetLoss) / newTotal;
  }
  
  this.statistics.totalTests = newTotal;
  this.lastUpdated = new Date();
  
  // Recalculate reliability score
  this.statistics.reliabilityScore = this.calculateReliabilityScore();
  
  return this.save();
};

ispSchema.methods.calculateReliabilityScore = function() {
  const stats = this.statistics;
  
  // Weighted scoring system
  const downloadScore = Math.min(100, (stats.averageDownload / 100) * 30); // 30% weight
  const uploadScore = Math.min(100, (stats.averageUpload / 50) * 20); // 20% weight
  const latencyScore = Math.max(0, 100 - stats.averageLatency) * 0.25; // 25% weight
  const jitterScore = Math.max(0, 100 - (stats.averageJitter * 2)) * 0.15; // 15% weight
  const packetLossScore = Math.max(0, 100 - (stats.averagePacketLoss * 10)) * 0.10; // 10% weight
  
  const totalScore = downloadScore + uploadScore + latencyScore + jitterScore + packetLossScore;
  
  return Math.min(100, Math.max(0, totalScore));
};

// Static methods
ispSchema.statics.getRankings = async function(country, options = {}) {
  const {
    metric = 'download', // download, upload, reliability, latency
    limit = 10,
    minTests = 10 // Minimum tests required to be ranked
  } = options;
  
  const sortField = {
    download: '-statistics.averageDownload',
    upload: '-statistics.averageUpload',
    reliability: '-statistics.reliabilityScore',
    latency: 'statistics.averageLatency' // Lower is better for latency
  }[metric] || '-statistics.averageDownload';
  
  const query = {
    country,
    isActive: true,
    'statistics.totalTests': { $gte: minTests }
  };
  
  return this.find(query)
    .select('name displayName region statistics')
    .sort(sortField)
    .limit(limit)
    .lean();
};

ispSchema.statics.findByASN = async function(asn) {
  return this.findOne({ asn, isActive: true });
};

ispSchema.statics.searchISPs = async function(searchTerm, country = null) {
  const query = {
    $text: { $search: searchTerm },
    isActive: true
  };
  
  if (country) {
    query.country = country;
  }
  
  return this.find(query)
    .select('name displayName country region statistics')
    .limit(20)
    .lean();
};

// Pre-save middleware
ispSchema.pre('save', function(next) {
  // Ensure statistics are within valid ranges
  if (this.statistics.reliabilityScore > 100) {
    this.statistics.reliabilityScore = 100;
  }
  if (this.statistics.reliabilityScore < 0) {
    this.statistics.reliabilityScore = 0;
  }
  
  this.lastUpdated = new Date();
  next();
});

// Virtual for ranking grade
ispSchema.virtual('rankingGrade').get(function() {
  const score = this.statistics.reliabilityScore;
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 45) return 'D';
  return 'F';
});

module.exports = mongoose.model('ISP', ispSchema);
