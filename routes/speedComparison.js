// routes/speedComparison.js
const express = require('express');
const router = express.Router();
const SpeedTest = require('../models/speedTest');
const NodeCache = require('node-cache');

// Cache for 15 minutes to reduce database load
const cache = new NodeCache({ stdTTL: 900 });

/**
 * GET /api/speed-comparison/averages
 * Get national and regional speed averages
 */
router.get('/averages', async (req, res) => {
  try {
    const { 
      country = 'ZA',
      region,
      city,
      timeframe = '30d',
      networkType,
      ispId
    } = req.query;

    // Create cache key
    const cacheKey = `averages_${country}_${region}_${city}_${timeframe}_${networkType}_${ispId}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json({ 
        success: true, 
        data: cached, 
        cached: true 
      });
    }

    const dateFilter = getDateFilter(timeframe);
    
    // Get national averages
    const nationalAverages = await calculateAverages({
      'location.country': country,
      isValid: true,
      isSuspicious: false,
      ...dateFilter
    });

    // Get regional averages (if region specified)
    let regionalAverages = null;
    if (region) {
      regionalAverages = await calculateAverages({
        'location.country': country,
        'location.region': region,
        isValid: true,
        isSuspicious: false,
        ...dateFilter
      });
    }

    // Get city averages (if city specified)
    let cityAverages = null;
    if (city) {
      cityAverages = await calculateAverages({
        'location.country': country,
        'location.city': city,
        isValid: true,
        isSuspicious: false,
        ...dateFilter
      });
    }

    // Get network type averages
    let networkTypeAverages = null;
    if (networkType) {
      networkTypeAverages = await calculateAverages({
        'location.country': country,
        networkType: networkType,
        isValid: true,
        isSuspicious: false,
        ...dateFilter
      });
    }

    // Get ISP-specific averages
    let ispAverages = null;
    if (ispId) {
      ispAverages = await calculateAverages({
        'location.country': country,
        ispId: ispId,
        isValid: true,
        isSuspicious: false,
        ...dateFilter
      });
    }

    // Get global averages for reference
    const globalAverages = await calculateAverages({
      isValid: true,
      isSuspicious: false,
      ...dateFilter
    });

    const result = {
      national: nationalAverages,
      regional: regionalAverages,
      city: cityAverages,
      networkType: networkTypeAverages,
      isp: ispAverages,
      global: globalAverages,
      metadata: {
        country,
        region,
        city,
        timeframe,
        networkType,
        generatedAt: new Date().toISOString()
      }
    };

    // Cache the result
    cache.set(cacheKey, result);

    res.json({ 
      success: true, 
      data: result,
      cached: false
    });

  } catch (error) {
    console.error('Speed comparison error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch speed comparisons',
      details: error.message 
    });
  }
});

/**
 * POST /api/speed-comparison/compare
 * Compare a specific test result against averages
 */
router.post('/compare', async (req, res) => {
  try {
    const {
      testId,
      downloadSpeed,
      uploadSpeed,
      latency,
      location,
      networkType,
      ispId
    } = req.body;

    // Get test data (either from ID or provided values)
    let testData;
    if (testId) {
      const test = await SpeedTest.findById(testId);
      if (!test) {
        return res.status(404).json({ error: 'Test not found' });
      }
      testData = {
        downloadSpeed: test.downloadSpeed,
        uploadSpeed: test.uploadSpeed,
        latency: test.latency,
        location: test.location,
        networkType: test.networkType,
        ispId: test.ispId
      };
    } else {
      testData = {
        downloadSpeed,
        uploadSpeed,
        latency,
        location,
        networkType,
        ispId
      };
    }

    // Fetch relevant averages
    const averagesResponse = await fetch(
      `${req.protocol}://${req.get('host')}/api/speed-comparison/averages?` +
      `country=${testData.location?.country || 'ZA'}&` +
      `region=${testData.location?.region || ''}&` +
      `city=${testData.location?.city || ''}&` +
      `networkType=${testData.networkType || ''}&` +
      `ispId=${testData.ispId || ''}&` +
      `timeframe=30d`
    );

    const averagesData = await averagesResponse.json();
    const averages = averagesData.data;

    // Calculate percentiles
    const comparison = {
      download: {
        speed: testData.downloadSpeed,
        vsNational: calculateComparison(testData.downloadSpeed, averages.national?.avgDownload),
        vsRegional: averages.regional ? calculateComparison(testData.downloadSpeed, averages.regional.avgDownload) : null,
        vsCity: averages.city ? calculateComparison(testData.downloadSpeed, averages.city.avgDownload) : null,
        vsGlobal: calculateComparison(testData.downloadSpeed, averages.global?.avgDownload),
        vsNetworkType: averages.networkType ? calculateComparison(testData.downloadSpeed, averages.networkType.avgDownload) : null,
        vsISP: averages.isp ? calculateComparison(testData.downloadSpeed, averages.isp.avgDownload) : null,
        percentile: await calculatePercentile(testData.downloadSpeed, 'downloadSpeed', testData.location?.country)
      },
      upload: {
        speed: testData.uploadSpeed,
        vsNational: calculateComparison(testData.uploadSpeed, averages.national?.avgUpload),
        vsRegional: averages.regional ? calculateComparison(testData.uploadSpeed, averages.regional.avgUpload) : null,
        vsCity: averages.city ? calculateComparison(testData.uploadSpeed, averages.city.avgUpload) : null,
        vsGlobal: calculateComparison(testData.uploadSpeed, averages.global?.avgUpload),
        vsNetworkType: averages.networkType ? calculateComparison(testData.uploadSpeed, averages.networkType.avgUpload) : null,
        vsISP: averages.isp ? calculateComparison(testData.uploadSpeed, averages.isp.avgUpload) : null,
        percentile: await calculatePercentile(testData.uploadSpeed, 'uploadSpeed', testData.location?.country)
      },
      latency: {
        value: testData.latency,
        vsNational: calculateLatencyComparison(testData.latency, averages.national?.avgLatency),
        vsRegional: averages.regional ? calculateLatencyComparison(testData.latency, averages.regional.avgLatency) : null,
        vsCity: averages.city ? calculateLatencyComparison(testData.latency, averages.city.avgLatency) : null,
        vsGlobal: calculateLatencyComparison(testData.latency, averages.global?.avgLatency),
        vsNetworkType: averages.networkType ? calculateLatencyComparison(testData.latency, averages.networkType.avgLatency) : null,
        vsISP: averages.isp ? calculateLatencyComparison(testData.latency, averages.isp.avgLatency) : null,
        percentile: await calculatePercentile(testData.latency, 'latency', testData.location?.country, true) // true = lower is better
      },
      summary: generateComparisonSummary(testData, averages),
      averages: averages
    };

    res.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ 
      error: 'Failed to compare speeds',
      details: error.message 
    });
  }
});

/**
 * GET /api/speed-comparison/percentiles
 * Get percentile distribution for a specific metric
 */
router.get('/percentiles', async (req, res) => {
  try {
    const {
      metric = 'downloadSpeed', // downloadSpeed, uploadSpeed, latency
      country = 'ZA',
      timeframe = '30d'
    } = req.query;

    const cacheKey = `percentiles_${metric}_${country}_${timeframe}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }

    const dateFilter = getDateFilter(timeframe);
    
    const results = await SpeedTest.find({
      'location.country': country,
      isValid: true,
      isSuspicious: false,
      ...dateFilter
    })
    .select(metric)
    .sort({ [metric]: 1 })
    .lean();

    const values = results.map(r => r[metric]).filter(v => v != null);
    
    if (values.length === 0) {
      return res.json({
        success: true,
        data: { percentiles: {}, distribution: [], sampleSize: 0 }
      });
    }

    const percentiles = {
      p1: getPercentileValue(values, 0.01),
      p5: getPercentileValue(values, 0.05),
      p10: getPercentileValue(values, 0.10),
      p25: getPercentileValue(values, 0.25),
      p50: getPercentileValue(values, 0.50),
      p75: getPercentileValue(values, 0.75),
      p90: getPercentileValue(values, 0.90),
      p95: getPercentileValue(values, 0.95),
      p99: getPercentileValue(values, 0.99),
      min: values[0],
      max: values[values.length - 1],
      mean: values.reduce((a, b) => a + b, 0) / values.length
    };

    // Create distribution histogram
    const distribution = createHistogram(values, 20);

    const result = {
      metric,
      percentiles,
      distribution,
      sampleSize: values.length,
      country,
      timeframe
    };

    cache.set(cacheKey, result);

    res.json({ success: true, data: result, cached: false });

  } catch (error) {
    console.error('Percentiles error:', error);
    res.status(500).json({ 
      error: 'Failed to calculate percentiles',
      details: error.message 
    });
  }
});

/**
 * GET /api/speed-comparison/rankings
 * Get rankings by region/city/ISP
 */
router.get('/rankings', async (req, res) => {
  try {
    const {
      groupBy = 'region', // region, city, isp, networkType
      country = 'ZA',
      metric = 'downloadSpeed',
      timeframe = '30d',
      limit = 20
    } = req.query;

    const dateFilter = getDateFilter(timeframe);
    
    let groupField;
    switch (groupBy) {
      case 'region':
        groupField = 'location.region';
        break;
      case 'city':
        groupField = 'location.city';
        break;
      case 'isp':
        groupField = 'ispId';
        break;
      case 'networkType':
        groupField = 'networkType';
        break;
      default:
        groupField = 'location.region';
    }

    const pipeline = [
      {
        $match: {
          'location.country': country,
          isValid: true,
          isSuspicious: false,
          [groupField]: { $exists: true, $ne: null },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: `$${groupField}`,
          avgDownload: { $avg: '$downloadSpeed' },
          avgUpload: { $avg: '$uploadSpeed' },
          avgLatency: { $avg: '$latency' },
          medianDownload: { $median: { input: '$downloadSpeed', method: 'approximate' } },
          count: { $sum: 1 },
          totalTests: { $sum: 1 }
        }
      },
      {
        $match: {
          totalTests: { $gte: 5 } // Minimum sample size
        }
      },
      {
        $sort: {
          [metric === 'latency' ? 'avgLatency' : `avg${metric.charAt(0).toUpperCase() + metric.slice(1)}`]: 
            metric === 'latency' ? 1 : -1
        }
      },
      { $limit: parseInt(limit) }
    ];

    // If grouping by ISP, populate ISP details
    if (groupBy === 'isp') {
      pipeline.push({
        $lookup: {
          from: 'isps',
          localField: '_id',
          foreignField: '_id',
          as: 'ispDetails'
        }
      });
      pipeline.push({
        $unwind: '$ispDetails'
      });
    }

    const rankings = await SpeedTest.aggregate(pipeline);

    // Format results
    const formattedRankings = rankings.map((item, index) => ({
      rank: index + 1,
      name: groupBy === 'isp' ? (item.ispDetails?.displayName || item.ispDetails?.name) : item._id,
      avgDownload: Math.round(item.avgDownload * 100) / 100,
      avgUpload: Math.round(item.avgUpload * 100) / 100,
      avgLatency: Math.round(item.avgLatency * 100) / 100,
      medianDownload: item.medianDownload ? Math.round(item.medianDownload * 100) / 100 : null,
      sampleSize: item.totalTests
    }));

    res.json({
      success: true,
      data: {
        rankings: formattedRankings,
        groupBy,
        metric,
        country,
        timeframe
      }
    });

  } catch (error) {
    console.error('Rankings error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rankings',
      details: error.message 
    });
  }
});

// ========== HELPER FUNCTIONS ==========

async function calculateAverages(query) {
  const results = await SpeedTest.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        avgDownload: { $avg: '$downloadSpeed' },
        avgUpload: { $avg: '$uploadSpeed' },
        avgLatency: { $avg: '$latency' },
        avgJitter: { $avg: '$jitter' },
        avgPacketLoss: { $avg: '$packetLoss' },
        minDownload: { $min: '$downloadSpeed' },
        maxDownload: { $max: '$downloadSpeed' },
        minUpload: { $min: '$uploadSpeed' },
        maxUpload: { $max: '$uploadSpeed' },
        minLatency: { $min: '$latency' },
        maxLatency: { $max: '$latency' },
        count: { $sum: 1 }
      }
    }
  ]);

  if (results.length === 0) {
    return null;
  }

  const result = results[0];
  return {
    avgDownload: Math.round(result.avgDownload * 100) / 100,
    avgUpload: Math.round(result.avgUpload * 100) / 100,
    avgLatency: Math.round(result.avgLatency * 100) / 100,
    avgJitter: Math.round((result.avgJitter || 0) * 100) / 100,
    avgPacketLoss: Math.round((result.avgPacketLoss || 0) * 100) / 100,
    minDownload: Math.round(result.minDownload * 100) / 100,
    maxDownload: Math.round(result.maxDownload * 100) / 100,
    minUpload: Math.round(result.minUpload * 100) / 100,
    maxUpload: Math.round(result.maxUpload * 100) / 100,
    minLatency: Math.round(result.minLatency * 100) / 100,
    maxLatency: Math.round(result.maxLatency * 100) / 100,
    sampleSize: result.count
  };
}

function calculateComparison(userValue, avgValue) {
  if (!avgValue || avgValue === 0) return null;
  
  const difference = userValue - avgValue;
  const percentDifference = (difference / avgValue) * 100;
  
  return {
    average: Math.round(avgValue * 100) / 100,
    difference: Math.round(difference * 100) / 100,
    percentDifference: Math.round(percentDifference * 100) / 100,
    isFaster: difference > 0,
    rating: getSpeedRating(percentDifference)
  };
}

function calculateLatencyComparison(userValue, avgValue) {
  if (!avgValue || avgValue === 0) return null;
  
  const difference = avgValue - userValue; // Reversed for latency (lower is better)
  const percentDifference = (difference / avgValue) * 100;
  
  return {
    average: Math.round(avgValue * 100) / 100,
    difference: Math.round(difference * 100) / 100,
    percentDifference: Math.round(percentDifference * 100) / 100,
    isBetter: difference > 0, // Lower latency is better
    rating: getLatencyRating(percentDifference)
  };
}

function getSpeedRating(percentDifference) {
  if (percentDifference >= 50) return 'excellent';
  if (percentDifference >= 20) return 'good';
  if (percentDifference >= -10) return 'average';
  if (percentDifference >= -30) return 'below_average';
  return 'poor';
}

function getLatencyRating(percentDifference) {
  if (percentDifference >= 30) return 'excellent';
  if (percentDifference >= 15) return 'good';
  if (percentDifference >= -10) return 'average';
  if (percentDifference >= -25) return 'below_average';
  return 'poor';
}

async function calculatePercentile(value, field, country, lowerIsBetter = false) {
  const results = await SpeedTest.find({
    'location.country': country,
    isValid: true,
    isSuspicious: false,
    [field]: { $exists: true }
  })
  .select(field)
  .sort({ [field]: lowerIsBetter ? -1 : 1 })
  .lean();

  const values = results.map(r => r[field]);
  const position = lowerIsBetter 
    ? values.filter(v => v > value).length
    : values.filter(v => v < value).length;
  
  const percentile = (position / values.length) * 100;
  return Math.round(percentile * 100) / 100;
}

function getPercentileValue(sortedValues, percentile) {
  const index = Math.ceil(sortedValues.length * percentile) - 1;
  return Math.round(sortedValues[index] * 100) / 100;
}

function createHistogram(values, bins) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binSize = (max - min) / bins;
  
  const histogram = Array(bins).fill(0).map((_, i) => ({
    range: `${Math.round((min + i * binSize) * 100) / 100} - ${Math.round((min + (i + 1) * binSize) * 100) / 100}`,
    count: 0,
    percentage: 0
  }));
  
  values.forEach(value => {
    const binIndex = Math.min(Math.floor((value - min) / binSize), bins - 1);
    histogram[binIndex].count++;
  });
  
  histogram.forEach(bin => {
    bin.percentage = Math.round((bin.count / values.length) * 10000) / 100;
  });
  
  return histogram;
}

function generateComparisonSummary(testData, averages) {
  const messages = [];
  
  // Download comparison
  if (averages.national) {
    const downloadDiff = ((testData.downloadSpeed - averages.national.avgDownload) / averages.national.avgDownload) * 100;
    if (downloadDiff > 50) {
      messages.push(`Your download speed is ${Math.round(downloadDiff)}% faster than the national average! 🚀`);
    } else if (downloadDiff > 20) {
      messages.push(`Your download speed is ${Math.round(downloadDiff)}% above the national average.`);
    } else if (downloadDiff < -30) {
      messages.push(`Your download speed is ${Math.abs(Math.round(downloadDiff))}% below the national average.`);
    }
  }
  
  // Upload comparison
  if (averages.national) {
    const uploadDiff = ((testData.uploadSpeed - averages.national.avgUpload) / averages.national.avgUpload) * 100;
    if (uploadDiff > 50) {
      messages.push(`Your upload speed is ${Math.round(uploadDiff)}% faster than the national average!`);
    }
  }
  
  // Latency comparison
  if (averages.national) {
    const latencyDiff = ((averages.national.avgLatency - testData.latency) / averages.national.avgLatency) * 100;
    if (latencyDiff > 30) {
      messages.push(`Your latency is ${Math.round(latencyDiff)}% better than the national average! 🎯`);
    } else if (latencyDiff < -30) {
      messages.push(`Your latency is ${Math.abs(Math.round(latencyDiff))}% higher than the national average.`);
    }
  }

  // Network type comparison
  if (averages.networkType) {
    const networkDownloadDiff = ((testData.downloadSpeed - averages.networkType.avgDownload) / averages.networkType.avgDownload) * 100;
    if (Math.abs(networkDownloadDiff) > 20) {
      messages.push(`Your speeds are ${Math.round(Math.abs(networkDownloadDiff))}% ${networkDownloadDiff > 0 ? 'above' : 'below'} average for ${testData.networkType} connections.`);
    }
  }

  return messages.length > 0 ? messages : ['Your speeds are within normal range for your area.'];
}

function getDateFilter(timeframe) {
  const now = new Date();
  let startDate;

  switch (timeframe) {
    case '24h':
      startDate = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
  }

  return { createdAt: { $gte: startDate } };
}

module.exports = router;