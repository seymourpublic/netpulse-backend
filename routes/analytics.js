const express = require('express');
const { Op, fn, col } = require('sequelize');
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
    const whereClause = {
      createdAt: { [Op.gte]: timeFilter },
      ...(ispId && { ispId }),
      ...(region && { 'location.region': region })
    };

    const groupBy = getGroupByClause(granularity);
    const metricColumn = getMetricColumn(metric);

    const trends = await SpeedTest.findAll({
      where: whereClause,
      attributes: [
        [fn('DATE_TRUNC', groupBy, col('createdAt')), 'period'],
        [fn('AVG', col(metricColumn)), 'average'],
        [fn('MIN', col(metricColumn)), 'minimum'],
        [fn('MAX', col(metricColumn)), 'maximum'],
        [fn('COUNT', '*'), 'testCount']
      ],
      group: [fn('DATE_TRUNC', groupBy, col('createdAt'))],
      order: [[fn('DATE_TRUNC', groupBy, col('createdAt')), 'ASC']],
      raw: true
    });

    res.json({
      trends: trends.map(t => ({
        period: t.period,
        average: parseFloat(t.average) || 0,
        minimum: parseFloat(t.minimum) || 0,
        maximum: parseFloat(t.maximum) || 0,
        testCount: parseInt(t.testCount) || 0
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
    const metricColumn = getMetricColumn(metric);
    
    const hourlyStats = await SpeedTest.findAll({
      where: {
        createdAt: { [Op.gte]: timeFilter },
        ...(ispId && { ispId })
      },
      attributes: [
        [fn('EXTRACT', 'hour', col('createdAt')), 'hour'],
        [fn('AVG', col(metricColumn)), 'average'],
        [fn('COUNT', '*'), 'testCount']
      ],
      group: [fn('EXTRACT', 'hour', col('createdAt'))],
      order: [[fn('EXTRACT', 'hour', col('createdAt')), 'ASC']],
      raw: true
    });

    // Fill in missing hours with zero values
    const allHours = Array.from({ length: 24 }, (_, i) => {
      const hourData = hourlyStats.find(h => parseInt(h.hour) === i);
      return {
        hour: i,
        average: hourData ? parseFloat(hourData.average) : 0,
        testCount: hourData ? parseInt(hourData.testCount) : 0
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
    const metricColumn = getMetricColumn(metric);

    const regionalStats = await SpeedTest.findAll({
      where: {
        createdAt: { [Op.gte]: timeFilter }
      },
      attributes: [
        [col('location.region'), 'region'],
        [col('location.country'), 'country'],
        [fn('AVG', col(metricColumn)), 'average'],
        [fn('COUNT', '*'), 'testCount'],
        [fn('COUNT', fn('DISTINCT', col('ispId'))), 'ispCount']
      ],
      group: [col('location.region'), col('location.country')],
      having: {
        [Op.and]: [
          { [fn('COUNT', '*')]: { [Op.gte]: 10 } }, // Minimum tests
          { [col('location.region')]: { [Op.ne]: null } }
        ]
      },
      order: [[fn('AVG', col(metricColumn)), 'DESC']],
      raw: true
    });

    res.json({
      regions: regionalStats.map(r => ({
        region: r.region,
        country: r.country,
        average: parseFloat(r.average) || 0,
        testCount: parseInt(r.testCount) || 0,
        ispCount: parseInt(r.ispCount) || 0
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

function getGroupByClause(granularity) {
  switch (granularity) {
    case 'hour': return 'hour';
    case 'day': return 'day';
    case 'week': return 'week';
    case 'month': return 'month';
    default: return 'day';
  }
}

function getMetricColumn(metric) {
  switch (metric) {
    case 'download': return 'downloadSpeed';
    case 'upload': return 'uploadSpeed';
    case 'latency': return 'latency';
    case 'jitter': return 'jitter';
    case 'quality': return 'qualityScore';
    default: return 'downloadSpeed';
  }
}

function calculateVariation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

module.exports = router;