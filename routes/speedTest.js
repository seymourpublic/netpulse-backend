// Updated speedTest.js route with enhanced network info

const express = require('express');
const { SpeedTest, ISP, UserSession } = require('../models');
const { getEnhancedNetworkInfo } = require('../services/locationService');
const { calculateQualityScore } = require('../utils/scoring');
const router = express.Router();
const CustomSpeedTestEngine = require('../services/customSpeedTestEngine');

// Add request logging middleware
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ENHANCED: Get network info endpoint with better IP detection
router.get('/network-info', async (req, res) => {
  try {
    console.log('🌍 Getting enhanced network info...');
    
    const networkInfo = await getEnhancedNetworkInfo(req);
    
    console.log('📊 Network info result:', networkInfo);
    
    res.json(networkInfo);

  } catch (error) {
    console.error('❌ Network info error:', error);
    res.status(500).json({ 
      error: 'Failed to get network info',
      details: error.message 
    });
  }
});

// Run comprehensive speed test (existing code with minor enhancements)
router.post('/comprehensive', async (req, res) => {
  try {
    console.log('🚀 Starting comprehensive speed test...');
    
    // Parse request body with validation
    let requestBody = {};
    try {
      if (typeof req.body === 'string') {
        requestBody = JSON.parse(req.body);
      } else {
        requestBody = req.body || {};
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({ 
        error: 'Invalid JSON in request body',
        details: parseError.message 
      });
    }

    const { sessionToken, testConfig = {} } = requestBody;
    
    // Generate session token if not provided
    const finalSessionToken = sessionToken || `netpulse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // ENHANCED: Get network information using new service
    let networkInfo;
    try {
      networkInfo = await getEnhancedNetworkInfo(req);
    } catch (locationError) {
      console.warn('Enhanced location detection failed:', locationError);
      networkInfo = {
        ip: '127.0.0.1',
        isp: 'Unknown ISP',
        location: {
          country: 'ZA',
          region: 'Gauteng',
          city: 'Johannesburg',
          lat: -26.2041,
          lng: 28.0473
        },
        connectionType: 'ethernet'
      };
    }

    // Get or create user session
    let session;
    try {
      session = await UserSession.findOne({ sessionToken: finalSessionToken });
      if (!session) {
        session = new UserSession({
          sessionToken: finalSessionToken,
          ipAddress: networkInfo.ip,
          userAgent: req.headers['user-agent'] || 'Unknown',
          location: networkInfo.location
        });
        await session.save();
        console.log('✅ Created new session:', session._id);
      } else {
        console.log('✅ Found existing session:', session._id);
      }
    } catch (sessionError) {
      console.error('Session error:', sessionError);
      session = { _id: null };
    }

    // Initialize speed test engine
    let speedTestEngine;
    try {
      speedTestEngine = new CustomSpeedTestEngine();
    } catch (engineError) {
      console.error('Speed test engine initialization failed:', engineError);
      return res.status(500).json({ 
        error: 'Failed to initialize speed test engine',
        details: engineError.message 
      });
    }
    
    // Run comprehensive speed test
    let testResult;
    try {
      console.log('🏃 Running speed test with config:', testConfig);
      
      const testPromise = speedTestEngine.runComprehensiveTest(networkInfo.ip, testConfig);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Speed test timeout after 60 seconds')), 60000)
      );
      
      testResult = await Promise.race([testPromise, timeoutPromise]);
      console.log('✅ Speed test completed successfully');
      
    } catch (testError) {
      console.error('❌ Speed test execution failed:', testError);
      return res.status(500).json({ 
        error: 'Speed test execution failed',
        details: testError.message 
      });
    }
    
    // Get or create ISP record
    let isp;
    try {
      const ispName = networkInfo.isp || testResult.networkInfo?.isp || 'Unknown ISP';
      
      isp = await ISP.findOne({ name: ispName });
      if (!isp) {
        isp = new ISP({
          name: ispName,
          displayName: ispName,
          country: networkInfo.location.country || 'Unknown',
          region: networkInfo.location.region || 'Unknown'
        });
        await isp.save();
        console.log('✅ Created new ISP record:', isp._id);
      }
    } catch (ispError) {
      console.error('ISP creation error:', ispError);
      isp = { _id: null, name: networkInfo.isp || 'Unknown ISP' };
    }

    // Calculate quality score with fallback
    let qualityScore = 0;
    try {
      if (testResult.results && testResult.results.quality) {
        qualityScore = testResult.results.quality.score || 0;
      } else {
        const downloadScore = Math.min(100, (testResult.results?.download?.speed || 0) / 10);
        const uploadScore = Math.min(100, (testResult.results?.upload?.speed || 0) / 5);
        const latencyScore = Math.max(0, 100 - (testResult.results?.latency?.avg || 100));
        qualityScore = (downloadScore + uploadScore + latencyScore) / 3;
      }
    } catch (qualityError) {
      console.warn('Quality score calculation failed:', qualityError);
      qualityScore = 0;
    }

    // FIXED: Prepare raw results data properly for MongoDB
    let rawResults = {
      downloadSamples: [],
      uploadSamples: [],
      latencySamples: [],
      comprehensive: null
    };

    try {
      if (testResult.results?.download?.samples && Array.isArray(testResult.results.download.samples)) {
        rawResults.downloadSamples = testResult.results.download.samples
          .map(sample => typeof sample === 'object' ? sample.speed : sample)
          .filter(speed => typeof speed === 'number' && !isNaN(speed))
          .slice(0, 100);
      }

      if (testResult.results?.upload?.samples && Array.isArray(testResult.results.upload.samples)) {
        rawResults.uploadSamples = testResult.results.upload.samples
          .map(sample => typeof sample === 'object' ? sample.speed : sample)
          .filter(speed => typeof speed === 'number' && !isNaN(speed))
          .slice(0, 100);
      }

      if (testResult.results?.latency?.samples && Array.isArray(testResult.results.latency.samples)) {
        rawResults.latencySamples = testResult.results.latency.samples
          .filter(latency => typeof latency === 'number' && !isNaN(latency))
          .slice(0, 50);
      }

      rawResults.comprehensive = {
        serverId: testResult.server?.id,
        duration: testResult.metadata?.duration,
        stages: testResult.metadata?.testStages?.length || 0,
        reliability: testResult.metadata?.reliability || 0
      };

    } catch (rawError) {
      console.warn('Raw results preparation failed:', rawError);
      rawResults = {
        downloadSamples: [],
        uploadSamples: [],
        latencySamples: [],
        comprehensive: null
      };
    }

    // Save comprehensive test result
    let speedTest;
    try {
      const speedTestData = {
        downloadSpeed: Number(testResult.results?.download?.speed) || 0,
        uploadSpeed: Number(testResult.results?.upload?.speed) || 0,
        latency: Number(testResult.results?.latency?.avg) || 0,
        jitter: Number(testResult.results?.latency?.jitter) || 0,
        packetLoss: Number(testResult.results?.packetLoss) || 0,
        testDuration: Number(testResult.metadata?.duration) || 0,
        ipAddress: String(networkInfo.ip),
        userAgent: String(req.headers['user-agent'] || 'Unknown'),
        deviceInfo: testResult.deviceInfo || {
          cpu: 'Unknown',
          memory: 'Unknown',
          os: 'Unknown'
        },
        networkType: networkInfo.connectionType || 'unknown',
        location: {
          city: String(networkInfo.location.city || 'Unknown'),
          region: String(networkInfo.location.region || 'Unknown'),
          country: String(networkInfo.location.country || 'Unknown'),
          lat: Number(networkInfo.location.lat) || 0,
          lng: Number(networkInfo.location.lng) || 0,
          timezone: String(networkInfo.location.timezone || 'UTC')
        },
        testServerId: String(testResult.server?.id || 'unknown'),
        rawResults: rawResults,
        qualityScore: Number(qualityScore),
        ispId: isp._id,
        sessionId: session._id
      };

      speedTest = new SpeedTest(speedTestData);
      await speedTest.save();
      console.log('✅ Speed test result saved successfully:', speedTest._id);

    } catch (saveError) {
      console.error('❌ Failed to save speed test result:', saveError);
      speedTest = { _id: 'unsaved' };
    }

    // Update ISP statistics (non-blocking)
    if (isp._id) {
      updateISPStats(isp._id).catch(error => {
        console.error('Failed to update ISP stats:', error);
      });
    }

    // Update session (non-blocking)
    if (session._id) {
      UserSession.findByIdAndUpdate(session._id, {
        lastActivity: new Date(),
        $inc: { totalTests: 1 }
      }).catch(error => {
        console.error('Failed to update session:', error);
      });
    }

    // Prepare response
    const response = {
      testId: speedTest._id,
      results: {
        download: {
          speed: testResult.results?.download?.speed || 0,
          consistency: testResult.results?.download?.consistency || 0
        },
        upload: {
          speed: testResult.results?.upload?.speed || 0,
          consistency: testResult.results?.upload?.consistency || 0
        },
        latency: {
          avg: testResult.results?.latency?.avg || 0,
          min: testResult.results?.latency?.min || 0,
          max: testResult.results?.latency?.max || 0,
          jitter: testResult.results?.latency?.jitter || 0
        },
        packetLoss: testResult.results?.packetLoss || 0,
        quality: testResult.results?.quality || { score: qualityScore, grade: 'N/A' }
      },
      metadata: {
        server: testResult.server || { id: 'unknown', location: 'Unknown' },
        duration: testResult.metadata?.duration || 0,
        reliability: testResult.metadata?.reliability || 0,
        testStages: testResult.metadata?.testStages || []
      },
      location: networkInfo.location,
      isp: isp.name,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Sending response with enhanced network info');
    res.json(response);

  } catch (error) {
    console.error('❌ Comprehensive speed test error:', error);
    res.status(500).json({ 
      error: 'Failed to run comprehensive speed test',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get test history (existing code)
router.get('/history', async (req, res) => {
  try {
    const { sessionToken, limit = 50, offset = 0 } = req.query;

    if (!sessionToken) {
      return res.json({ tests: [], total: 0, hasMore: false });
    }

    const session = await UserSession.findOne({ sessionToken });
    if (!session) {
      return res.json({ tests: [], total: 0, hasMore: false });
    }

    const tests = await SpeedTest.find({ sessionId: session._id })
      .populate('ispId', 'name displayName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await SpeedTest.countDocuments({ sessionId: session._id });

    const transformedTests = tests.map(test => ({
      _id: test._id,
      timestamp: test.createdAt,
      download: test.downloadSpeed,
      upload: test.uploadSpeed,
      latency: test.latency,
      jitter: test.jitter,
      packetLoss: test.packetLoss,
      qualityScore: test.qualityScore,
      hour: new Date(test.createdAt).getHours(),
      time: `${new Date(test.createdAt).getHours()}:00`,
      isp: test.ispId ? (test.ispId.displayName || test.ispId.name) : 'Unknown'
    }));

    res.json({
      tests: transformedTests,
      total,
      hasMore: total > (parseInt(offset) + parseInt(limit))
    });

  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch test history',
      details: error.message 
    });
  }
});

// Get test details (existing code)
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
    res.status(500).json({ 
      error: 'Failed to fetch test details',
      details: error.message 
    });
  }
});

// Helper function to update ISP statistics
async function updateISPStats(ispId) {
  try {
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
        'statistics.averageDownload': Math.round((stat.avgDownload || 0) * 100) / 100,
        'statistics.averageUpload': Math.round((stat.avgUpload || 0) * 100) / 100,
        'statistics.averageLatency': Math.round((stat.avgLatency || 0) * 100) / 100,
        'statistics.totalTests': stat.totalTests || 0,
        'statistics.reliabilityScore': reliabilityScore,
        lastUpdated: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating ISP stats:', error);
  }
}

function calculateReliabilityScore(speeds, packetLosses) {
  if (!speeds || speeds.length === 0) return 0;

  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speeds.length;
  const consistencyScore = Math.max(0, 100 - (variance / mean) * 100);

  const avgPacketLoss = packetLosses.reduce((a, b) => a + b, 0) / packetLosses.length;
  const packetLossScore = Math.max(0, 100 - avgPacketLoss * 10);

  return Math.round((consistencyScore * 0.7 + packetLossScore * 0.3) * 100) / 100;
}

module.exports = router;