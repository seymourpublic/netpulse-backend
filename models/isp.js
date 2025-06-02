const mongoose = require('mongoose');

const ispSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: String,
  country: {
    type: String,
    required: true
  },
  region: String,
  asn: {
    type: Number,
    unique: true,
    sparse: true // Allows multiple null values
  },
  website: String,
  supportContact: String,
  statistics: {
    averageDownload: {
      type: Number,
      default: 0
    },
    averageUpload: {
      type: Number,
      default: 0
    },
    averageLatency: {
      type: Number,
      default: 0
    },
    reliabilityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    totalTests: {
      type: Number,
      default: 0
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed // Flexible object
  }
}, {
  timestamps: true
});

// Indexes
ispSchema.index({ country: 1 });
ispSchema.index({ 'statistics.reliabilityScore': -1 });
ispSchema.index({ 'statistics.averageDownload': -1 });
ispSchema.index({ asn: 1 });

module.exports = mongoose.model('ISP', ispSchema);