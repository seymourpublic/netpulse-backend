const cron = require('node-cron');
const { SpeedTest, ISP, NetworkOutage } = require('../models');

class BackgroundService {
  constructor() {
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('🔄 Starting background services...');

    // Update ISP statistics every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      console.log('📊 Updating ISP statistics...');
      await this.updateISPStatistics();
    });

    // Detect outages every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('🔍 Checking for network outages...');
      await this.detectNetworkOutages();
    });

    // Clean old data daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Cleaning old data...');
      await this.cleanOldData();
    });

    console.log('✅ Background services started');
  }

  async updateISPStatistics() {
    try {
      const isps = await ISP.find({ isActive: true });
      
      for (const isp of isps) {
        const stats = await this.calculateISPStats(isp._id);
        await ISP.findByIdAndUpdate(isp._id, { statistics: stats, lastUpdated: new Date() });
      }
      
      console.log(`Updated statistics for ${isps.length} ISPs`);
    } catch (error) {
      console.error('Error updating ISP statistics:', error);
    }
  }

  async calculateISPStats(ispId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const stats = await SpeedTest.aggregate([
      { 
        $match: { 
          ispId: ispId,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          avgDownload: { $avg: '$downloadSpeed' },
          avgUpload: { $avg: '$uploadSpeed' },
          avgLatency: { $avg: '$latency' },
          avgPacketLoss: { $avg: '$packetLoss' },
          totalTests: { $sum: 1 },
          speeds: { $push: '$downloadSpeed' }
        }
      }
    ]);

    if (stats.length === 0) {
      return {
        averageDownload: 0,
        averageUpload: 0,
        averageLatency: 0,
        reliabilityScore: 0,
        totalTests: 0
      };
    }

    const stat = stats[0];
    
    // Calculate reliability score
    const mean = stat.avgDownload;
    const variance = stat.speeds.reduce((acc, speed) => acc + Math.pow(speed - mean, 2), 0) / stat.speeds.length;
    const consistencyScore = Math.max(0, 100 - (variance / mean) * 100);
    const packetLossScore = Math.max(0, 100 - stat.avgPacketLoss * 10);
    const reliabilityScore = (consistencyScore * 0.7 + packetLossScore * 0.3);

    return {
      averageDownload: Math.round((stat.avgDownload || 0) * 100) / 100,
      averageUpload: Math.round((stat.avgUpload || 0) * 100) / 100,
      averageLatency: Math.round((stat.avgLatency || 0) * 100) / 100,
      reliabilityScore: Math.round(reliabilityScore * 100) / 100,
      totalTests: stat.totalTests || 0
    };
  }

  async detectNetworkOutages() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const isps = await ISP.find({ isActive: true });
      
      for (const isp of isps) {
        const recentTestCount = await SpeedTest.countDocuments({
          ispId: isp._id,
          createdAt: { $gte: oneHourAgo }
        });

        const recentAvgSpeed = await SpeedTest.aggregate([
          {
            $match: {
              ispId: isp._id,
              createdAt: { $gte: oneHourAgo }
            }
          },
          {
            $group: {
              _id: null,
              avgSpeed: { $avg: '$downloadSpeed' }
            }
          }
        ]);

        const currentAvg = recentAvgSpeed[0]?.avgSpeed || 0;
        const expectedAvg = isp.statistics?.averageDownload || 0;

        // Check for potential outage conditions
        const hasOutage = (
          recentTestCount === 0 || // No tests in the last hour
          (currentAvg > 0 && expectedAvg > 0 && currentAvg < expectedAvg * 0.3) // Speed dropped by 70%
        );

        if (hasOutage) {
          await this.recordNetworkOutage(isp._id, recentTestCount === 0 ? 'critical' : 'major');
        }
      }
      
    } catch (error) {
      console.error('Error detecting network outages:', error);
    }
  }

  async recordNetworkOutage(ispId, severity) {
    const existingOutage = await NetworkOutage.findOne({
      ispId: ispId,
      isResolved: false
    });

    if (!existingOutage) {
      const outage = new NetworkOutage({
        ispId,
        startTime: new Date(),
        severity,
        source: 'automated',
        description: `Detected ${severity} performance degradation`
      });

      await outage.save();
      console.log(`🚨 Network outage detected for ISP ${ispId} (${severity})`);
    }
  }

  async cleanOldData() {
    try {
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      // Clean old speed tests
      const deletedTests = await SpeedTest.deleteMany({
        createdAt: { $lt: sixMonthsAgo }
      });

      // Clean resolved outages older than 3 months
      const deletedOutages = await NetworkOutage.deleteMany({
        isResolved: true,
        endTime: { $lt: threeMonthsAgo }
      });

      console.log(`🧹 Cleaned ${deletedTests.deletedCount} old tests and ${deletedOutages.deletedCount} resolved outages`);
      
    } catch (error) {
      console.error('Error cleaning old data:', error);
    }
  }
}

const backgroundService = new BackgroundService();

module.exports = {
  startBackgroundServices: () => backgroundService.start()
};