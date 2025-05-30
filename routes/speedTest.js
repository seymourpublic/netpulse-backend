const express = require('express');
const { Op } = require('sequelize');
const { SpeedTest, ISP, UserSession } = require('../models');
const { performSpeedTest } = require('../services/speedTestService');
const { getLocationFromIP } = require('../services/locationService');
const { calculateQualityScore } = require('../utils/scoring');
const router = express.Router();

// Run speed test
router.post('/run', async (req, res) => {
  try {
    const { sessionToken, testConfig = {} } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Get or create user session
    let session = await UserSession.findOne({ where: { sessionToken } });
    if (!session) {
      session = await UserSession.create({
        sessionToken: sessionToken || require('uuid').v4(),
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        location: await getLocationFromIP(clientIP)
      });
    }

    // Perform speed test
    const testResult = await performSpeedTest(clientIP, testConfig);
    
    // Get ISP information
    let isp = await ISP.findOne({ where: { name: testResult.isp } });
    if (!isp) {
      isp = await ISP.create({
        name: testResult.isp,
        country: testResult.location.country,
        region: testResult.location.region
      });
    }

    // Calculate quality score
    const qualityScore = calculateQualityScore(testResult);

    // Save test result
    const speedTest = await SpeedTest.create({
      downloadSpeed: testResult.download,
      uploadSpeed: testResult.upload,
      latency: testResult.latency,
      jitter: testResult.jitter,
      packetLoss: testResult.packetLoss,
      testDuration: testResult.duration,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      deviceInfo: testResult.deviceInfo,
      networkType: testResult.networkType,
      location: testResult.location,
      testServerId: testResult.serverId,
      rawResults: testResult.raw,
      qualityScore,
      ispId: isp.id,
      sessionId: session.id
    });

    // Update ISP statistics
    await updateISPStats(isp.id);

    // Update session
    await session.update({
      lastActivity: new Date(),
      totalTests: session.totalTests + 1
    });

    res.json({
      testId: speedTest.id,
      results: {
        download: speedTest.downloadSpeed,
        upload: speedTest.uploadSpeed,
        latency: speedTest.latency,
        jitter: speedTest.jitter,
        packetLoss: speedTest.packetLoss,
        qualityScore: speedTest.qualityScore
      },
      location: speedTest.location,
      isp: isp.name,
      timestamp: speedTest.createdAt
    });

  } catch (error) {
    console.error('Speed test error:', error);
    res.status(500).json({ error: 'Failed to run speed test' });
  }
});

// Get test history
router.get('/history', async (req, res) => {
  try {
    const { sessionToken, limit = 50, offset = 0 } = req.query;

    const session = await UserSession.findOne({ where: { sessionToken } });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const tests = await SpeedTest.findAndCountAll({
      where: { sessionId: session.id },
      include: [{ model: ISP, attributes: ['name', 'displayName'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      tests: tests.rows,
      total: tests.count,
      hasMore: tests.count > (parseInt(offset) + parseInt(limit))
    });

  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch test history' });
  }
});

// Get test details
router.get('/:testId', async (req, res) => {
  try {
    const test = await SpeedTest.findByPk(req.params.testId, {
      include: [
        { model: ISP, attributes: ['name', 'displayName', 'website'] },
        { model: UserSession, attributes: ['sessionToken'] }
      ]
    });

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json(test);

  } catch (error) {
    console.error('Test fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch test details' });
  }
});

async function updateISPStats(ispId) {
  const stats = await SpeedTest.findOne({
    where: { ispId },
    attributes: [
      [require('sequelize').fn('AVG', require('sequelize').col('downloadSpeed')), 'avgDownload'],
      [require('sequelize').fn('AVG', require('sequelize').col('uploadSpeed')), 'avgUpload'],
      [require('sequelize').fn('AVG', require('sequelize').col('latency')), 'avgLatency'],
      [require('sequelize').fn('COUNT', '*'), 'totalTests']
    ],
    raw: true
  });

  const reliabilityScore = await calculateReliabilityScore(ispId);

  await ISP.update({
    averageDownload: parseFloat(stats.avgDownload) || 0,
    averageUpload: parseFloat(stats.avgUpload) || 0,
    averageLatency: parseFloat(stats.avgLatency) || 0,
    totalTests: parseInt(stats.totalTests) || 0,
    reliabilityScore,
    lastUpdated: new Date()
  }, {
    where: { id: ispId }
  });
}

async function calculateReliabilityScore(ispId) {
  // Calculate based on consistency and outages
  const recentTests = await SpeedTest.findAll({
    where: {
      ispId,
      createdAt: {
        [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    },
    attributes: ['downloadSpeed', 'packetLoss'],
    raw: true
  });

  if (recentTests.length === 0) return 0;

  // Calculate consistency (lower variance = higher score)
  const speeds = recentTests.map(t => t.downloadSpeed);
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speeds.length;
  const consistencyScore = Math.max(0, 100 - (variance / mean) * 100);

  // Calculate packet loss penalty
  const avgPacketLoss = recentTests.reduce((a, b) => a + b.packetLoss, 0) / recentTests.length;
  const packetLossScore = Math.max(0, 100 - avgPacketLoss * 10);

  return (consistencyScore * 0.7 + packetLossScore * 0.3);
}

module.exports = router;