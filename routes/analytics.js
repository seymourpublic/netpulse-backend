const express = require('express');
const { SpeedTest, ISP } = require('../models');
const router = express.Router();

// Get performance trends
router.get('/trends', async (req, res) => {
  try {
    const { 
      timeframe = '30d',
      metric = 'download',
      ispId,
      region,
      granularity = 'day'
    } = req.query;

    const timeFilter = getTimeFilter(timeframe);
    const matchStage = {
      createdAt: { $gte: timeFilter }
    };

    if (ispId) {
      matchStage.ispId = require('mongoose').Types.ObjectId(ispId);
    }
    if (region) {
      matchStage['location.region'] = region;
    }

    const metricField = getMetricField(metric);
    const groupByStage = getGroupByStage(granularity);

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: groupByStage,
          average: { $avg: metricField },
          minimum: { $min: metricField },
          maximum: { $max: metricField },
          testCount: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ];

    const trends = await SpeedTest.aggregate(pipeline);

    res.json({
      trends: trends.map(t => ({
        period: t._id,
        average: Math.round((t.average || 0) * 100) / 100,
        minimum: Math.round((t.minimum || 0) * 100) / 100,
        maximum: Math.round((t.maximum || 0) * 100) / 100,
        testCount: t.testCount || 0
      })),
      metadata: {
        timeframe,
        metric,
        granularity,
        ispId,
        region
      }
    });

  } catch (error) {
    console.error('Trends fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch performance trends' });
  }
});

// Get peak hours analysis
router.get('/peak-hours', async (req, res) => {
  try {
    const { timeframe = '30d', ispId, metric = 'download' } = req.query;
    
    const timeFilter = getTimeFilter(timeframe);
    const matchStage = {
      createdAt: { $gte: timeFilter }
    };
    
    if (ispId) {
      matchStage.ispId = require('mongoose').Types.ObjectId(ispId);
    }

    const metricField = getMetricField(metric);
    
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          average: { $avg: metricField },
          testCount: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ];

    const hourlyStats = await SpeedTest.aggregate(pipeline);

    // Fill in missing hours with zero values
    const allHours = Array.from({ length: 24 }, (_, i) => {
      const hourData = hourlyStats.find(h => h._id === i);
      return {
        hour: i,
        average: hourData ? Math.round(hourData.average * 100) / 100 : 0,
        testCount: hourData ? hourData.testCount : 0
      };
    });

    // Identify peak and off-peak hours
    const sortedHours = [...allHours].sort((a, b) => b.average - a.average);
    const peakHours = sortedHours.slice(0, 6).map(h => h.hour);
    const offPeakHours = sortedHours.slice(-6).map(h => h.hour);

    res.json({
      hourlyData: allHours,
      peakHours,
      offPeakHours,
      insights: {
        bestHour: sortedHours[0],
        worstHour: sortedHours[sortedHours.length - 1],
        averageVariation: calculateVariation(allHours.map(h => h.average))
      }
    });

  } catch (error) {
    console.error('Peak hours analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze peak hours' });
  }
});

// Get regional comparison
router.get('/regional', async (req, res) => {
  try {
    const { timeframe = '30d', metric = 'download' } = req.query;
    
    const timeFilter = getTimeFilter(timeframe);
    const metricField = getMetricField(metric);

    const pipeline = [
      { $match: { createdAt: { $gte: timeFilter } } },
      {
        $group: {
          _id: {
            region: '$location.region',
            country: '$location.country'
          },
          average: { $avg: metricField },
          testCount: { $sum: 1 },
          ispCount: { $addToSet: '$ispId' }
        }
      },
      {
        $match: {
          testCount: { $gte: 10 }, // Minimum tests
          '_id.region': { $ne: null }
        }
      },
      {
        $project: {
          region: '$_id.region',
          country: '$_id.country',
          average: 1,
          testCount: 1,
          ispCount: { $size: '$ispCount' }
        }
      },
      { $sort: { average: -1 } }
    ];

    const regionalStats = await SpeedTest.aggregate(pipeline);

    res.json({
      regions: regionalStats.map(r => ({
        region: r.region,
        country: r.country,
        average: Math.round((r.average || 0) * 100) / 100,
        testCount: r.testCount || 0,
        ispCount: r.ispCount || 0
      })),
      metadata: { timeframe, metric }
    });

  } catch (error) {
    console.error('Regional analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze regional data' });
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

function getGroupByStage(granularity) {
  switch (granularity) {
    case 'hour': 
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' }
      };
    case 'day':
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
    case 'week':
      return {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
    case 'month':
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
    default:
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
  }
}

function getMetricField(metric) {
  switch (metric) {
    case 'download': return '$downloadSpeed';
    case 'upload': return '$uploadSpeed';
    case 'latency': return '$latency';
    case 'jitter': return '$jitter';
    case 'quality': return '$qualityScore';
    default: return '$downloadSpeed';
  }
}

function calculateVariation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

module.exports = router;