const express = require('express');
const { NetworkOutage, ISP, SpeedTest } = require('../models');
const router = express.Router();

// Get current outages
router.get('/outages', async (req, res) => {
  try {
    const { status = 'active', severity, region } = req.query;
    
    const matchQuery = {};
    
    if (status === 'active') {
      matchQuery.isResolved = false;
    } else if (status === 'resolved') {
      matchQuery.isResolved = true;
    }
    
    if (severity) {
      matchQuery.severity = severity;
    }

    let outages = await NetworkOutage.find(matchQuery)
      .populate('ispId', 'name displayName region country')
      .sort({ startTime: -1 })
      .limit(100);

    // Filter by region if specified
    if (region) {
      outages = outages.filter(outage => 
        outage.ispId && outage.ispId.region === region
      );
    }

    const activeCount = await NetworkOutage.countDocuments({ isResolved: false });

    res.json({
      outages,
      summary: {
        total: outages.length,
        active: activeCount,
        resolved: outages.length - activeCount
      }
    });

  } catch (error) {
    console.error('Outages fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch network outages' });
  }
});

// Report outage manually
router.post('/outages/report', async (req, res) => {
  try {
    const {
      ispId,
      severity = 'minor',
      description,
      affectedRegions = [],
      userReport = false
    } = req.body;

    if (!ispId) {
      return res.status(400).json({ error: 'ISP ID is required' });
    }

    const isp = await ISP.findById(ispId);
    if (!isp) {
      return res.status(404).json({ error: 'ISP not found' });
    }

    // Check if there's already an active outage for this ISP
    const existingOutage = await NetworkOutage.findOne({
      ispId: ispId,
      isResolved: false
    });

    if (existingOutage) {
      return res.status(409).json({ 
        error: 'Active outage already exists for this ISP',
        outage: existingOutage
      });
    }

    const outage = new NetworkOutage({
      ispId,
      startTime: new Date(),
      severity,
      description: description || `${userReport ? 'User reported' : 'Manual'} outage for ${isp.name}`,
      affectedRegions,
      source: userReport ? 'user_report' : 'manual',
      impactScore: calculateImpactScore(severity, affectedRegions.length)
    });

    await outage.save();

    res.status(201).json({
      message: 'Outage reported successfully',
      outage
    });

  } catch (error) {
    console.error('Outage report error:', error);
    res.status(500).json({ error: 'Failed to report outage' });
  }
});

// Resolve outage
router.patch('/outages/:outageId/resolve', async (req, res) => {
  try {
    const { outageId } = req.params;
    const { resolution } = req.body;

    const outage = await NetworkOutage.findById(outageId);
    if (!outage) {
      return res.status(404).json({ error: 'Outage not found' });
    }

    if (outage.isResolved) {
      return res.status(400).json({ error: 'Outage already resolved' });
    }

    outage.endTime = new Date();
    outage.isResolved = true;
    if (resolution) {
      outage.description = resolution;
    }

    await outage.save();

    res.json({
      message: 'Outage resolved successfully',
      outage
    });

  } catch (error) {
    console.error('Outage resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve outage' });
  }
});

// Get system health metrics
router.get('/health', async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Recent test metrics using aggregation
    const recentTestsStats = await SpeedTest.aggregate([
      { $match: { createdAt: { $gte: oneHourAgo } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgDownload: { $avg: '$downloadSpeed' },
          avgLatency: { $avg: '$latency' }
        }
      }
    ]);

    const recentTests = recentTestsStats[0] || { count: 0, avgDownload: 0, avgLatency: 0 };

    // Active outages
    const activeOutages = await NetworkOutage.countDocuments({ isResolved: false });

    // ISP performance summary
    const ispStats = await ISP.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalIsps: { $sum: 1 },
          avgReliability: { $avg: '$statistics.reliabilityScore' }
        }
      }
    ]);

    const ispSummary = ispStats[0] || { totalIsps: 0, avgReliability: 0 };

    // Daily test volume
    const dailyVolume = await SpeedTest.countDocuments({
      createdAt: { $gte: oneDayAgo }
    });

    const health = {
      status: activeOutages === 0 ? 'healthy' : activeOutages < 5 ? 'warning' : 'critical',
      metrics: {
        recentTests: recentTests.count,
        averageDownload: Math.round((recentTests.avgDownload || 0) * 100) / 100,
        averageLatency: Math.round((recentTests.avgLatency || 0) * 100) / 100,
        activeOutages,
        totalIsps: ispSummary.totalIsps,
        averageReliability: Math.round((ispSummary.avgReliability || 0) * 100) / 100,
        dailyTestVolume: dailyVolume
      },
      timestamp: now.toISOString()
    };

    res.json(health);

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to get system health',
      timestamp: new Date().toISOString()
    });
  }
});

function calculateImpactScore(severity, regionCount) {
  const severityMultiplier = {
    'minor': 1,
    'major': 2,
    'critical': 3
  };
  
  return Math.min(100, (severityMultiplier[severity] || 1) * 20 + regionCount * 5);
}

module.exports = router;