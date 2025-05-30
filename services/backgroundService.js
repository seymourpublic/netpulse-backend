const cron = require('node-cron');
const { SpeedTest, ISP, NetworkOutage } = require('../models');
const { Op } = require('sequelize');

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

    // Generate daily reports at 6 AM
    cron.schedule('0 6 * * *', async () => {
      console.log('📈 Generating daily reports...');
      await this.generateDailyReports();
    });

    console.log('✅ Background services started');
  }

  async updateISPStatistics() {
    try {
      const isps = await ISP.findAll({ where: { isActive: true } });
      
      for (const isp of isps) {
        const stats = await this.calculateISPStats(isp.id);
        await isp.update(stats);
      }
      
      console.log(`Updated statistics for ${isps.length} ISPs`);
    } catch (error) {
      console.error('Error updating ISP statistics:', error);
    }
  }

  async calculateISPStats(ispId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const tests = await SpeedTest.findAll({
      where: {
        ispId,
        createdAt: { [Op.gte]: thirtyDaysAgo }
      },
      attributes: ['downloadSpeed', 'uploadSpeed', 'latency', 'packetLoss']
    });

    if (tests.length === 0) {
      return {
        averageDownload: 0,
        averageUpload: 0,
        averageLatency: 0,
        reliabilityScore: 0,
        totalTests: 0,
        lastUpdated: new Date()
      };
    }

    const avgDownload = tests.reduce((sum, t) => sum + t.downloadSpeed, 0) / tests.length;
    const avgUpload = tests.reduce((sum, t) => sum + t.uploadSpeed, 0) / tests.length;
    const avgLatency = tests.reduce((sum, t) => sum + t.latency, 0) / tests.length;
    const avgPacketLoss = tests.reduce((sum, t) => sum + t.packetLoss, 0) / tests.length;

    // Calculate reliability score based on consistency and packet loss
    const downloadSpeeds = tests.map(t => t.downloadSpeed);
    const downloadVariance = this.calculateVariance(downloadSpeeds);
    const consistencyScore = Math.max(0, 100 - (downloadVariance / avgDownload) * 100);
    const packetLossScore = Math.max(0, 100 - avgPacketLoss * 10);
    const reliabilityScore = (consistencyScore * 0.7 + packetLossScore * 0.3);

    return {
      averageDownload: Math.round(avgDownload * 100) / 100,
      averageUpload: Math.round(avgUpload * 100) / 100,
      averageLatency: Math.round(avgLatency * 100) / 100,
      reliabilityScore: Math.round(reliabilityScore * 100) / 100,
      totalTests: tests.length,
      lastUpdated: new Date()
    };
  }

  calculateVariance(numbers) {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    return numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
  }

  async detectNetworkOutages() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Find ISPs with significantly degraded performance or no tests
      const isps = await ISP.findAll({ where: { isActive: true } });
      
      for (const isp of isps) {
        const recentTests = await SpeedTest.count({
          where: {
            ispId: isp.id,
            createdAt: { [Op.gte]: oneHourAgo }
          }
        });

        const recentAvgSpeed = await SpeedTest.findOne({
          where: {
            ispId: isp.id,
            createdAt: { [Op.gte]: oneHourAgo }
          },
          attributes: [
            [require('sequelize').fn('AVG', require('sequelize').col('downloadSpeed')), 'avgSpeed']
          ],
          raw: true
        });

        // Check for potential outage conditions
        const hasOutage = (
          recentTests === 0 || // No tests in the last hour
          (recentAvgSpeed?.avgSpeed && recentAvgSpeed.avgSpeed < isp.averageDownload * 0.3) // Speed dropped by 70%
        );

        if (hasOutage) {
          await this.recordNetworkOutage(isp.id, recentTests === 0 ? 'critical' : 'major');
        }
      }
      
    } catch (error) {
      console.error('Error detecting network outages:', error);
    }
  }

  async recordNetworkOutage(ispId, severity) {
    const existingOutage = await NetworkOutage.findOne({
      where: {
        ispId,
        isResolved: false
      }
    });

    if (!existingOutage) {
      await NetworkOutage.create({
        ispId,
        startTime: new Date(),
        severity,
        source: 'automated',
        description: `Detected ${severity} performance degradation`
      });
      
      console.log(`🚨 Network outage detected for ISP ${ispId} (${severity})`);
    }
  }

  async cleanOldData() {
    try {
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      
      // Clean old speed tests (keep only 6 months)
      const deletedTests = await SpeedTest.destroy({
        where: {
          createdAt: { [Op.lt]: sixMonthsAgo }
        }
      });

      // Clean resolved outages older than 3 months
      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deletedOutages = await NetworkOutage.destroy({
        where: {
          isResolved: true,
          endTime: { [Op.lt]: threeMonthsAgo }
        }
      });

      console.log(`🧹 Cleaned ${deletedTests} old tests and ${deletedOutages} resolved outages`);
      
    } catch (error) {
      console.error('Error cleaning old data:', error);
    }
  }

  async generateDailyReports() {
    try {
      // Generate summary statistics for the previous day
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
      const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));

      const dailyStats = await SpeedTest.findOne({
        where: {
          createdAt: {
            [Op.between]: [startOfDay, endOfDay]
          }
        },
        attributes: [
          [require('sequelize').fn('COUNT', '*'), 'totalTests'],
          [require('sequelize').fn('AVG', require('sequelize').col('downloadSpeed')), 'avgDownload'],
          [require('sequelize').fn('AVG', require('sequelize').col('uploadSpeed')), 'avgUpload'],
          [require('sequelize').fn('AVG', require('sequelize').col('latency')), 'avgLatency']
        ],
        raw: true
      });

      console.log('📈 Daily Report:', {
        date: yesterday.toISOString().split('T')[0],
        totalTests: dailyStats?.totalTests || 0,
        avgDownload: Math.round((dailyStats?.avgDownload || 0) * 100) / 100,
        avgUpload: Math.round((dailyStats?.avgUpload || 0) * 100) / 100,
        avgLatency: Math.round((dailyStats?.avgLatency || 0) * 100) / 100
      });
      
    } catch (error) {
      console.error('Error generating daily reports:', error);
    }
  }
}

const backgroundService = new BackgroundService();

module.exports = {
  startBackgroundServices: () => backgroundService.start()
};