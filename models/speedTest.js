const mongoose = require('mongoose');

const speedTestSchema = new mongoose.Schema({
  downloadSpeed: {
    type: Number,
    required: true,
    min: 0
  },
  uploadSpeed: {
    type: Number,
    required: true,
    min: 0
  },
  latency: {
    type: Number,
    required: true,
    min: 0
  },
  jitter: {
    type: Number,
    required: true,
    min: 0
  },
  packetLoss: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 100
  },
  testDuration: {
    type: Number,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  deviceInfo: {
    cpu: String,
    memory: String,
    os: String,
    cores: Number
  },
  networkType: {
    type: String,
    enum: ['wifi', 'ethernet', 'mobile', 'unknown'],
    default: 'unknown'
  },
  location: {
    city: String,
    country: String,
    region: String,
    lat: Number,
    lng: Number,
    timezone: String
  },
  testServerId: String,
  rawResults: {
    downloadSamples: [Number],
    uploadSamples: [Number],
    latencySamples: [Number]
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 100
  },
  ispId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ISP'
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSession'
  },
  serverNodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServerNode'
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better query performance
speedTestSchema.index({ createdAt: -1 });
speedTestSchema.index({ ispId: 1 });
speedTestSchema.index({ 'location.country': 1 });
speedTestSchema.index({ qualityScore: -1 });
speedTestSchema.index({ networkType: 1 });

module.exports = mongoose.model('SpeedTest', speedTestSchema);