const express = require('express');
const { ISP, SpeedTest } = require('../models');
const router = express.Router();

// Get ISP rankings
router.get('/rankings', async (req, res) => {
  try {
    const { 
      region, 
      country = 'US', 
      metric = 'download',
      timeframe = '30d',
      limit = 20 
    } = req.query;

    const matchQuery = {
      country,
      'statistics.totalTests': { $gt: 10 }, // Minimum tests for ranking
      isActive: true
    };

    if (region) {
      matchQuery.region = region;
    }

    const sortField = getSortField(metric);
    
    const rankings = await ISP.find(matchQuery)
      .select('name displayName region statistics')
      .sort(sortField)
      .limit(parseInt(limit));

    res.json({
      rankings,
      metadata: {
        metric,
        timeframe,
        region: region || 'all',
        country,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Rankings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch ISP rankings' });
  }
});

// Get ISP details
router.get('/:ispId', async (req, res) => {
  try {
    const isp = await ISP.findById(req.params.ispId);
    
    if (!isp) {
      return res.status(404).json({ error: 'ISP not found' });
    }

    // Get recent performance data (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recentTests = await SpeedTest.find({
      ispId: isp._id,
      createdAt: { $gte: thirtyDaysAgo }
    })
    .select('downloadSpeed uploadSpeed latency createdAt')
    .sort({ createdAt: -1 })
    .limit(100);

    res.json({
      isp,
      recentPerformance: recentTests,
      statistics: {
        testsLast30Days: recentTests.length,
        peakHours: await getPeakHours(isp._id),
        regionalComparison: await getRegionalComparison(isp._id)
      }
    });

  } catch (error) {
    console.error('ISP details error:', error);
    res.status(500).json({ error: 'Failed to fetch ISP details' });
  }
});

function getSortField(metric) {
  switch (metric) {
    case 'download': return { 'statistics.averageDownload': -1 };
    case 'upload': return { 'statistics.averageUpload': -1 };
    case 'latency': return { 'statistics.averageLatency': 1 };
    case 'reliability': return { 'statistics.reliabilityScore': -1 };
    default: return { 'statistics.averageDownload': -1 };
  }
}

async function getPeakHours(ispId) {
  // MongoDB aggregation for peak hours analysis
  try {
    const pipeline = [
      { $match: { ispId: ispId } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          avgSpeed: { $avg: '$downloadSpeed' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ];
    
    return await SpeedTest.aggregate(pipeline);
  } catch (error) {
    return [];
  }
}

async function getRegionalComparison(ispId) {
  // Implementation for regional comparison
  return {};
}

module.exports = router;