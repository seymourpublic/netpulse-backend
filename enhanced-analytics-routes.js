// routes/analytics.js - ENHANCED VERSION
const express = require('express');
const router = express.Router();
const SpeedTest = require('../models/speedTest');
const ISP = require('../models/isp');
const UserSession = require('../models/userSession');
const mongoose = require('mongoose');

/**
 * GET /api/analytics/overview
 * Comprehensive analytics overview
 */
router.get('/overview', async (req, res) => {
  try {
    const { 
      timeframe = '7d', // 24h, 7d, 30d, 90d, 1y, all
      country = 'ZA',
      ispId,
      sessionToken
    } = req.query;

    const dateFilter = getDateFilter(timeframe);
    const baseQuery = { 
      isValid: true,
      isSuspicious: false,
      ...dateFilter 
    };

    if (country) baseQuery['location.country'] = country;
    if (ispId) baseQuery.ispId = mongoose.Types.ObjectId(ispId);
    if (sessionToken) {
      const session = await UserSession.findOne({ sessionToken });
      if (session) baseQuery.sessionId = session._id;
    }

    // Parallel queries for better performance
    const [
      totalTests,
      avgMetrics,
      qualityDistribution,
      networkTypeDistribution,
      peakHours,
      trends
    ] = await Promise.all([
      SpeedTest.countDocuments(baseQuery),
      getAverageMetrics(baseQuery),
      getQualityDistribution(baseQuery),
      getNetworkTypeDistribution(baseQuery),
      getPeakHours(baseQuery),
      getTrends(baseQuery, timeframe)
    ]);

    res.json({
      success: true,
      timeframe,
      data: {
        summary: {
          totalTests,
          averages: avgMetrics,
          qualityDistribution,
          networkTypeDistribution
        },
        peakHours,
        trends
      }
    });

  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

/**
 * GET /api/analytics/trends
 * Detailed trend analysis with multiple metrics
 */
router.get('/trends', async (req, res) => {
  try {
    const { 
      timeframe = '7d',
      interval = 'auto', // hour, day, week, month, auto
      metric = 'all', // download, upload, latency, quality, all
      country,
      ispId
    } = req.query;

    const dateFilter = getDateFilter(timeframe);
    const groupInterval = interval === 'auto' ? getAutoInterval(timeframe) : interval;
    
    const baseQuery = {
      isValid: true,
      isSuspicious: false,
      ...dateFilter
    };

    if (country) baseQuery['location.country'] = country;
    if (ispId) baseQuery.ispId = mongoose.Types.ObjectId(ispId);

    const trends = await SpeedTest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: getTimeGrouping(groupInterval),
          avgDownload: { $avg: '$downloadSpeed' },
          avgUpload: { $avg: '$uploadSpeed' },
          avgLatency: { $avg: '$latency' },
          avgJitter: { $avg: '$jitter' },
          avgPacketLoss: { $avg: '$packetLoss' },
          avgQuality: { $avg: '$qualityScore' },
          minDownload: { $min: '$downloadSpeed' },
          maxDownload: { $max: '$downloadSpeed' },
          minUpload: { $min: '$uploadSpeed' },
          maxUpload: { $max: '$uploadSpeed' },
          count: { $sum: 1 },
          // Calculate percentiles
          downloadSpeeds: { $push: '$downloadSpeed' },
          uploadSpeeds: { $push: '$uploadSpeed' },
          latencies: { $push: '$latency' }
        }
      },
      { $sort: { '_id': 1 } },
      {
        $project: {
          timestamp: convertIdToTimestamp('$_id', groupInterval),
          avgDownload: { $round: ['$avgDownload', 2] },
          avgUpload: { $round: ['$avgUpload', 2] },
          avgLatency: { $round: ['$avgLatency', 2] },
          avgJitter: { $round: ['$avgJitter', 2] },
          avgPacketLoss: { $round: ['$avgPacketLoss', 2] },
          avgQuality: { $round: ['$avgQuality', 2] },
          minDownload: { $round: ['$minDownload', 2] },
          maxDownload: { $round: ['$maxDownload', 2] },
          minUpload: { $round: ['$minUpload', 2] },
          maxUpload: { $round: ['$maxUpload', 2] },
          count: 1,
          downloadSpeeds: 1,
          uploadSpeeds: 1,
          latencies: 1
        }
      }
    ]);

    // Calculate percentiles for each data point
    const enhancedTrends = trends.map(point => {
      const downloadPercentiles = calculatePercentiles(point.downloadSpeeds);
      const uploadPercentiles = calculatePercentiles(point.uploadSpeeds);
      const latencyPercentiles = calculatePercentiles(point.latencies);

      return {
        ...point,
        downloadP50: downloadPercentiles.p50,
        downloadP95: downloadPercentiles.p95,
        uploadP50: uploadPercentiles.p50,
        uploadP95: uploadPercentiles.p95,
        latencyP50: latencyPercentiles.p50,
        latencyP95: latencyPercentiles.p95,
        // Remove raw arrays from response
        downloadSpeeds: undefined,
        uploadSpeeds: undefined,
        latencies: undefined
      };
    });

    res.json({
      success: true,
      interval: groupInterval,
      data: enhancedTrends
    });

  } catch (error) {
    console.error('Trends analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

/**
 * GET /api/analytics/comparison
 * Compare multiple ISPs or time periods
 */
router.get('/comparison', async (req, res) => {
  try {
    const { 
      ispIds, // comma-separated ISP IDs
      timeframe = '30d',
      country = 'ZA'
    } = req.query;

    if (!ispIds) {
      return res.status(400).json({ error: 'ISP IDs are required' });
    }

    const ispIdArray = ispIds.split(',').map(id => mongoose.Types.ObjectId(id));
    const dateFilter = getDateFilter(timeframe);

    const comparison = await Promise.all(
      ispIdArray.map(async (ispId) => {
        const isp = await ISP.findById(ispId);
        if (!isp) return null;

        const stats = await SpeedTest.aggregate([
          {
            $match: {
              ispId,
              'location.country': country,
              isValid: true,
              isSuspicious: false,
              ...dateFilter
            }
          },
          {
            $group: {
              _id: null,
              avgDownload: { $avg: '$downloadSpeed' },
              avgUpload: { $avg: '$uploadSpeed' },
              avgLatency: { $avg: '$latency' },
              avgJitter: { $avg: '$jitter' },
              avgPacketLoss: { $avg: '$packetLoss' },
              avgQuality: { $avg: '$qualityScore' },
              minDownload: { $min: '$downloadSpeed' },
              maxDownload: { $max: '$downloadSpeed' },
              consistencyDownload: { $stdDevPop: '$downloadSpeed' },
              consistencyUpload: { $stdDevPop: '$uploadSpeed' },
              totalTests: { $sum: 1 }
            }
          }
        ]);

        return {
          isp: {
            id: isp._id,
            name: isp.displayName || isp.name,
            region: isp.region
          },
          stats: stats[0] || {}
        };
      })
    );

    res.json({
      success: true,
      timeframe,
      data: comparison.filter(item => item !== null)
    });

  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Failed to compare ISPs' });
  }
});

/**
 * GET /api/analytics/heatmap
 * Performance heatmap by hour of day and day of week
 */
router.get('/heatmap', async (req, res) => {
  try {
    const { 
      timeframe = '30d',
      metric = 'download', // download, upload, latency, quality
      country,
      ispId
    } = req.query;

    const dateFilter = getDateFilter(timeframe);
    const baseQuery = {
      isValid: true,
      isSuspicious: false,
      ...dateFilter
    };

    if (country) baseQuery['location.country'] = country;
    if (ispId) baseQuery.ispId = mongoose.Types.ObjectId(ispId);

    const metricField = getMetricField(metric);

    const heatmapData = await SpeedTest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: '$createdAt' }, // 1 = Sunday, 7 = Saturday
            hour: { $hour: '$createdAt' }
          },
          avgValue: { $avg: metricField },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 } }
    ]);

    // Transform to matrix format
    const matrix = Array(7).fill(null).map(() => Array(24).fill(null));
    
    heatmapData.forEach(item => {
      const day = item._id.dayOfWeek - 1; // Convert to 0-indexed
      const hour = item._id.hour;
      matrix[day][hour] = {
        value: Math.round(item.avgValue * 100) / 100,
        count: item.count
      };
    });

    res.json({
      success: true,
      metric,
      data: {
        matrix,
        raw: heatmapData
      }
    });

  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ error: 'Failed to generate heatmap' });
  }
});

/**
 * GET /api/analytics/predictions
 * Predict performance based on historical data
 */
router.get('/predictions', async (req, res) => {
  try {
    const { 
      country = 'ZA',
      ispId,
      horizon = '7d' // How far to predict: 1d, 7d, 30d
    } = req.query;

    // Get historical data for the past 30 days
    const historicalData = await SpeedTest.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          'location.country': country,
          ...(ispId && { ispId: mongoose.Types.ObjectId(ispId) }),
          isValid: true,
          isSuspicious: false
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          avgDownload: { $avg: '$downloadSpeed' },
          avgUpload: { $avg: '$uploadSpeed' },
          avgLatency: { $avg: '$latency' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Simple moving average prediction
    const predictions = generatePredictions(historicalData, horizon);

    res.json({
      success: true,
      horizon,
      data: {
        historical: historicalData,
        predictions
      }
    });

  } catch (error) {
    console.error('Predictions error:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

/**
 * GET /api/analytics/anomalies
 * Detect anomalies in network performance
 */
router.get('/anomalies', async (req, res) => {
  try {
    const {
      timeframe = '7d',
      country,
      ispId,
      threshold = 2.5 // Standard deviations from mean
    } = req.query;

    const dateFilter = getDateFilter(timeframe);
    const baseQuery = {
      isValid: true,
      ...dateFilter
    };

    if (country) baseQuery['location.country'] = country;
    if (ispId) baseQuery.ispId = mongoose.Types.ObjectId(ispId);

    // Get statistics
    const stats = await SpeedTest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          avgDownload: { $avg: '$downloadSpeed' },
          stdDevDownload: { $stdDevPop: '$downloadSpeed' },
          avgUpload: { $avg: '$uploadSpeed' },
          stdDevUpload: { $stdDevPop: '$uploadSpeed' },
          avgLatency: { $avg: '$latency' },
          stdDevLatency: { $stdDevPop: '$latency' }
        }
      }
    ]);

    if (!stats[0]) {
      return res.json({ success: true, data: [] });
    }

    const { avgDownload, stdDevDownload, avgUpload, stdDevUpload, avgLatency, stdDevLatency } = stats[0];

    // Find anomalies
    const anomalies = await SpeedTest.find({
      ...baseQuery,
      $or: [
        { downloadSpeed: { $lt: avgDownload - (threshold * stdDevDownload) } },
        { downloadSpeed: { $gt: avgDownload + (threshold * stdDevDownload) } },
        { uploadSpeed: { $lt: avgUpload - (threshold * stdDevUpload) } },
        { uploadSpeed: { $gt: avgUpload + (threshold * stdDevUpload) } },
        { latency: { $gt: avgLatency + (threshold * stdDevLatency) } }
      ]
    })
    .select('downloadSpeed uploadSpeed latency createdAt location.city ispId')
    .populate('ispId', 'name displayName')
    .sort({ createdAt: -1 })
    .limit(100);

    res.json({
      success: true,
      threshold,
      statistics: stats[0],
      data: anomalies
    });

  } catch (error) {
    console.error('Anomalies detection error:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data in various formats
 */
router.get('/export', async (req, res) => {
  try {
    const {
      format = 'csv', // csv, json, xlsx
      timeframe = '30d',
      country,
      ispId
    } = req.query;

    const dateFilter = getDateFilter(timeframe);
    const baseQuery = {
      isValid: true,
      isSuspicious: false,
      ...dateFilter
    };

    if (country) baseQuery['location.country'] = country;
    if (ispId) baseQuery.ispId = mongoose.Types.ObjectId(ispId);

    const data = await SpeedTest.find(baseQuery)
      .populate('ispId', 'name displayName')
      .select('downloadSpeed uploadSpeed latency jitter packetLoss qualityScore createdAt location networkType')
      .sort({ createdAt: -1 })
      .lean();

    if (format === 'csv') {
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=netpulse-analytics-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        format,
        count: data.length,
        data
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Helper functions
function getDateFilter(timeframe) {
  const now = new Date();
  const filters = {
    '24h': new Date(now - 24 * 60 * 60 * 1000),
    '7d': new Date(now - 7 * 24 * 60 * 60 * 1000),
    '30d': new Date(now - 30 * 24 * 60 * 60 * 1000),
    '90d': new Date(now - 90 * 24 * 60 * 60 * 1000),
    '1y': new Date(now - 365 * 24 * 60 * 60 * 1000)
  };

  return timeframe === 'all' ? {} : { createdAt: { $gte: filters[timeframe] || filters['7d'] } };
}

function getAutoInterval(timeframe) {
  const intervals = {
    '24h': 'hour',
    '7d': 'hour',
    '30d': 'day',
    '90d': 'day',
    '1y': 'week',
    'all': 'month'
  };
  return intervals[timeframe] || 'day';
}

function getTimeGrouping(interval) {
  switch (interval) {
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

function convertIdToTimestamp(id, interval) {
  // This would need proper implementation based on your needs
  return '$_id';
}

function getMetricField(metric) {
  const fields = {
    download: '$downloadSpeed',
    upload: '$uploadSpeed',
    latency: '$latency',
    jitter: '$jitter',
    quality: '$qualityScore'
  };
  return fields[metric] || '$downloadSpeed';
}

async function getAverageMetrics(query) {
  const result = await SpeedTest.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        avgDownload: { $avg: '$downloadSpeed' },
        avgUpload: { $avg: '$uploadSpeed' },
        avgLatency: { $avg: '$latency' },
        avgJitter: { $avg: '$jitter' },
        avgPacketLoss: { $avg: '$packetLoss' },
        avgQuality: { $avg: '$qualityScore' }
      }
    }
  ]);

  return result[0] || {};
}

async function getQualityDistribution(query) {
  const distribution = await SpeedTest.aggregate([
    { $match: query },
    {
      $bucket: {
        groupBy: '$qualityScore',
        boundaries: [0, 50, 60, 70, 80, 90, 100],
        default: 'other',
        output: {
          count: { $sum: 1 },
          avgScore: { $avg: '$qualityScore' }
        }
      }
    }
  ]);

  return distribution;
}

async function getNetworkTypeDistribution(query) {
  return await SpeedTest.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$networkType',
        count: { $sum: 1 },
        avgDownload: { $avg: '$downloadSpeed' }
      }
    },
    { $sort: { count: -1 } }
  ]);
}

async function getPeakHours(query) {
  return await SpeedTest.aggregate([
    { $match: query },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        avgDownload: { $avg: '$downloadSpeed' },
        avgLatency: { $avg: '$latency' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
}

async function getTrends(query, timeframe) {
  const interval = getAutoInterval(timeframe);
  return await SpeedTest.aggregate([
    { $match: query },
    {
      $group: {
        _id: getTimeGrouping(interval),
        avgDownload: { $avg: '$downloadSpeed' },
        avgUpload: { $avg: '$uploadSpeed' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
}

function calculatePercentiles(values) {
  if (!values || values.length === 0) return { p50: 0, p95: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const p50Index = Math.floor(sorted.length * 0.5);
  const p95Index = Math.floor(sorted.length * 0.95);
  
  return {
    p50: sorted[p50Index],
    p95: sorted[p95Index]
  };
}

function generatePredictions(historicalData, horizon) {
  // Simple moving average prediction
  if (historicalData.length < 3) return [];
  
  const last3 = historicalData.slice(-3);
  const avgDownload = last3.reduce((sum, d) => sum + d.avgDownload, 0) / 3;
  const avgUpload = last3.reduce((sum, d) => sum + d.avgUpload, 0) / 3;
  const avgLatency = last3.reduce((sum, d) => sum + d.avgLatency, 0) / 3;
  
  const days = horizon === '1d' ? 1 : horizon === '7d' ? 7 : 30;
  const predictions = [];
  
  for (let i = 1; i <= days; i++) {
    predictions.push({
      day: i,
      predictedDownload: Math.round(avgDownload * 100) / 100,
      predictedUpload: Math.round(avgUpload * 100) / 100,
      predictedLatency: Math.round(avgLatency * 100) / 100,
      confidence: Math.max(0.5, 0.9 - (i * 0.02)) // Decreasing confidence
    });
  }
  
  return predictions;
}

function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = [
    'Date',
    'ISP',
    'Download (Mbps)',
    'Upload (Mbps)',
    'Latency (ms)',
    'Jitter (ms)',
    'Packet Loss (%)',
    'Quality Score',
    'City',
    'Network Type'
  ];
  
  const rows = data.map(item => [
    new Date(item.createdAt).toISOString(),
    item.ispId?.displayName || item.ispId?.name || 'Unknown',
    item.downloadSpeed,
    item.uploadSpeed,
    item.latency,
    item.jitter,
    item.packetLoss,
    item.qualityScore,
    item.location?.city || 'Unknown',
    item.networkType || 'Unknown'
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

module.exports = router;
