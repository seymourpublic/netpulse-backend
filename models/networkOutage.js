const mongoose = require('mongoose');

const networkOutageSchema = new mongoose.Schema({
  ispId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ISP',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  severity: {
    type: String,
    enum: ['minor', 'major', 'critical'],
    required: true
  },
  affectedRegions: [String],
  description: String,
  source: {
    type: String,
    enum: ['automated', 'manual', 'user_report'],
    default: 'automated'
  },
  impactScore: {
    type: Number,
    min: 0,
    max: 100
  },
  isResolved: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
networkOutageSchema.index({ startTime: -1 });
networkOutageSchema.index({ severity: 1 });
networkOutageSchema.index({ ispId: 1 });
networkOutageSchema.index({ isResolved: 1 });

module.exports = mongoose.model('NetworkOutage', networkOutageSchema);
