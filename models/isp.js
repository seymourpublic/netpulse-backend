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
    // REMOVED: unique: true (will be added via schema.index below)
    sparse: true
  },
  website: String,
  supportContact: String,
  statistics: {
    averageDownload: { type: Number, default: 0 },
    averageUpload: { type: Number, default: 0 },
    averageLatency: { type: Number, default: 0 },
    reliabilityScore: { type: Number, default: 0, min: 0, max: 100 },
    totalTests: { type: Number, default: 0 }
  },
  lastUpdated: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

// FIXED: Indexes - only define once here
ispSchema.index({ country: 1 });
ispSchema.index({ 'statistics.reliabilityScore': -1 });
ispSchema.index({ 'statistics.averageDownload': -1 });
ispSchema.index({ asn: 1 }, { unique: true, sparse: true }); // Define unique here

module.exports = mongoose.model('ISP', ispSchema);