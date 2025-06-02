const express = require('express');
const { SpeedTest, ISP, UserSession } = require('../models');
const { performSpeedTest } = require('../services/speedTestService');
const { getLocationFromIP } = require('../services/locationService');
const { calculateQualityScore } = require('../utils/scoring');
const router = express.Router();
const CustomSpeedTestEngine = require('../services/customSpeedTestEngine');

// Run speed test
router.post('/run', async (req, res) => {
  try {
    const { sessionToken, testConfig = {} } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Get or create user session
    let session = await UserSession.findOne({ sessionToken });
    if (!session) {
      session = new UserSession({
        sessionToken: sessionToken || require('uuid').v4(),
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        location: await getLocationFromIP(clientIP)
      });
      await session.save();
    }

    // Perform speed test
    const testResult = await performSpeedTest(clientIP, testConfig);
    
    // Get or create ISP
    let isp = await ISP.findOne({ name: testResult.isp });
    if (!isp) {
      isp = new ISP({
        name: testResult.isp,
        country: testResult.location.country,
        region: testResult.location.region
      });
      await isp.save();
    }

    // Calculate quality score
    const qualityScore = calculateQualityScore(testResult);

    // Save test result
    const speedTest = new SpeedTest({
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
      ispId: isp._id,
      sessionId: session._id
    });

    await speedTest.save();

    // Update ISP statistics
    await updateISPStats(isp._id);

    // Update session
    session.lastActivity = new Date();
    session.totalTests += 1;
    await session.save();

    res.json({
      testId: speedTest._id,
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

    const session = await UserSession.findOne({ sessionToken });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const tests = await SpeedTest.find({ sessionId: session._id })
      .populate('ispId', 'name displayName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await SpeedTest.countDocuments({ sessionId: session._id });

    res.json({
      tests,
      total,
      hasMore: total > (parseInt(offset) + parseInt(limit))
    });

  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch test history' });
  }
});

// Get test details
router.get('/:testId', async (req, res) => {
  try {
    const test = await SpeedTest.findById(req.params.testId)
      .populate('ispId', 'name displayName website')
      .populate('sessionId', 'sessionToken');

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
  try {
    // Use MongoDB aggregation pipeline for statistics
    const stats = await SpeedTest.aggregate([
      { $match: { ispId: ispId } },
      {
        $group: {
          _id: null,
          avgDownload: { $avg: '$downloadSpeed' },
          avgUpload: { $avg: '$uploadSpeed' },
          avgLatency: { $avg: '$latency' },
          totalTests: { $sum: 1 },
          speeds: { $push: '$downloadSpeed' },
          packetLosses: { $push: '$packetLoss' }
        }
      }
    ]);

    if (stats.length > 0) {
      const stat = stats[0];
      const reliabilityScore = calculateReliabilityScore(stat.speeds, stat.packetLosses);

      await ISP.findByIdAndUpdate(ispId, {
        'statistics.averageDownload': stat.avgDownload || 0,
        'statistics.averageUpload': stat.avgUpload || 0,
        'statistics.averageLatency': stat.avgLatency || 0,
        'statistics.totalTests': stat.totalTests || 0,
        'statistics.reliabilityScore': reliabilityScore,
        lastUpdated: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating ISP stats:', error);
  }
}

router.post('/comprehensive', async (req, res) => {
  try {
    const { sessionToken, testConfig = {} } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Get or create user session
    let session = await UserSession.findOne({ sessionToken });
    if (!session) {
      session = new UserSession({
        sessionToken: sessionToken || require('uuid').v4(),
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        location: await getLocationFromIP(clientIP)
      });
      await session.save();
    }

    // Initialize custom speed test engine
    const speedTestEngine = new CustomSpeedTestEngine();
    
    // Run comprehensive speed test
    const testResult = await speedTestEngine.runComprehensiveTest(clientIP, testConfig);
    
    // Get or create ISP
    let isp = await ISP.findOne({ name: testResult.networkInfo?.isp || 'Unknown ISP' });
    if (!isp) {
      isp = new ISP({
        name: testResult.networkInfo?.isp || 'Unknown ISP',
        country: testResult.networkInfo?.location?.country || 'Unknown',
        region: testResult.networkInfo?.location?.region || 'Unknown'
      });
      await isp.save();
    }

    // Save comprehensive test result
    const speedTest = new SpeedTest({
      downloadSpeed: testResult.results.download.speed,
      uploadSpeed: testResult.results.upload.speed,
      latency: testResult.results.latency.avg,
      jitter: testResult.results.latency.jitter,
      packetLoss: testResult.results.packetLoss,
      testDuration: testResult.metadata.duration,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      deviceInfo: testResult.deviceInfo,
      networkType: testResult.networkInfo?.type || 'unknown',
      location: testResult.networkInfo?.location,
      testServerId: testResult.server?.id,
      rawResults: {
        downloadSamples: testResult.results.download.samples,
        uploadSamples: testResult.results.upload.samples,
        latencySamples: testResult.results.latency.samples,
        comprehensive: testResult
      },
      qualityScore: testResult.results.quality.score,
      ispId: isp._id,
      sessionId: session._id
    });

    await speedTest.save();

    // Update ISP statistics
    await updateISPStats(isp._id);

    // Update session
    session.lastActivity = new Date();
    session.totalTests += 1;
    await session.save();

    res.json({
      testId: speedTest._id,
      results: {
        download: {
          speed: testResult.results.download.speed,
          consistency: testResult.results.download.consistency
        },
        upload: {
          speed: testResult.results.upload.speed,
          consistency: testResult.results.upload.consistency
        },
        latency: {
          avg: testResult.results.latency.avg,
          min: testResult.results.latency.min,
          max: testResult.results.latency.max,
          jitter: testResult.results.latency.jitter
        },
        packetLoss: testResult.results.packetLoss,
        quality: testResult.results.quality
      },
      metadata: {
        server: testResult.server,
        duration: testResult.metadata.duration,
        reliability: testResult.metadata.reliability,
        testStages: testResult.metadata.testStages
      },
      location: testResult.networkInfo?.location,
      isp: isp.name,
      timestamp: speedTest.createdAt
    });

  } catch (error) {
    console.error('Comprehensive speed test error:', error);
    res.status(500).json({ 
      error: 'Failed to run comprehensive speed test',
      details: error.message 
    });
  }
});


function calculateReliabilityScore(speeds, packetLosses) {
  if (!speeds || speeds.length === 0) return 0;

  // Calculate consistency (lower variance = higher score)
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speeds.length;
  const consistencyScore = Math.max(0, 100 - (variance / mean) * 100);

  // Calculate packet loss penalty
  const avgPacketLoss = packetLosses.reduce((a, b) => a + b, 0) / packetLosses.length;
  const packetLossScore = Math.max(0, 100 - avgPacketLoss * 10);

  return Math.round((consistencyScore * 0.7 + packetLossScore * 0.3) * 100) / 100;
}

module.exports = router;