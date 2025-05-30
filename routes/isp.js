const express = require('express');
const { Op } = require('sequelize');
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

    const timeFilter = getTimeFilter(timeframe);
    
    const rankings = await ISP.findAll({
      where: {
        country,
        ...(region && { region }),
        totalTests: { [Op.gt]: 10 } // Minimum tests for ranking
      },
      attributes: [
        'id', 'name', 'displayName', 'region',
        'averageDownload', 'averageUpload', 'averageLatency',
        'reliabilityScore', 'totalTests'
      ],
      order: getSortOrder(metric),
      limit: parseInt(limit)
    });

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
    const isp = await ISP.findByPk(req.params.ispId);
    
    if (!isp) {
      return res.status(404).json({ error: 'ISP not found' });
    }

    // Get recent performance data
    const recentTests = await SpeedTest.findAll({
      where: {
        ispId: isp.id,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      attributes: ['downloadSpeed', 'uploadSpeed', 'latency', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.json({
      isp,
      recentPerformance: recentTests,
      statistics: {
        testsLast30Days: recentTests.length,
        peakHours: await getPeakHours(isp.id),
        regionalComparison: await getRegionalComparison(isp.id)
      }
    });

  } catch (error) {
    console.error('ISP details error:', error);
    res.status(500).json({ error: 'Failed to fetch ISP details' });
  }
});

function getTimeFilter(timeframe) {
  const now = new Date();
  switch (timeframe) {
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function getSortOrder(metric) {
  switch (metric) {
    case 'download': return [['averageDownload', 'DESC']];
    case 'upload': return [['averageUpload', 'DESC']];
    case 'latency': return [['averageLatency', 'ASC']];
    case 'reliability': return [['reliabilityScore', 'DESC']];
    default: return [['averageDownload', 'DESC']];
  }
}

async function getPeakHours(ispId) {
  // Implementation for peak hours analysis
  return [];
}

async function getRegionalComparison(ispId) {
  // Implementation for regional comparison
  return {};
}

module.exports = router;