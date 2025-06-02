const mongoose = require('mongoose');

const serverNodeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  location: {
    city: String,
    region: String,
    country: String,
    lat: Number,
    lng: Number
  },
  ipAddress: {
    type: String,
    required: true
  },
  port: {
    type: Number,
    default: 80
  },
  provider: String,
  isActive: {
    type: Boolean,
    default: true
  },
  lastHealthCheck: Date,
  averageResponseTime: Number,
  capacity: {
    type: Number,
    default: 100
  },
  currentLoad: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
serverNodeSchema.index({ 'location.country': 1 });
serverNodeSchema.index({ isActive: 1 });

module.exports = mongoose.model('ServerNode', serverNodeSchema);
