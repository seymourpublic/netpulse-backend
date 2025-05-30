const express = require('express');
const { Op } = require('sequelize');
const { NetworkOutage, ISP, SpeedTest } = require('../models');
const router = express.Router();

// Get current outages
router.get('/outages', async (req, res) => {
  try {
    const { status = 'active', severity, region } = req.query;
    
    const whereClause = {};
    
    if (status === 'active') {
      whereClause.isResolved = false;
    } else if (status === 'resolved') {
      whereClause.isResolved = true;
    }
    
    if (severity) {
      whereClause.severity = severity;
    }

    const outages = await NetworkOutage.findAll({
      where: whereClause,
      include: [{
        model: ISP,
        attributes: ['name', 'displayName', 'region', 'country'],
        ...(region && { where: { region } })
      }],
      order: [['startTime', 'DESC']],
      limit: 100
    });

    const activeCount = await NetworkOutage.count({
      where: { isResolved: false }
    });

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

    const isp = await ISP.findByPk(ispId);
    if (!isp) {
      return res.status(404).json({ error: 'ISP not found' });
    }

    // Check if there's already an active outage for this ISP
    const existingOutage = await NetworkOutage.findOne({
      where: {
        ispId,
        isResolved: false
      }
    });

    if (existingOutage) {
      return res.status(409).json({ 
        error: 'Active outage already exists for this ISP',
        outage: existingOutage
      });
    }

    const outage = await NetworkOutage.create({
      ispId,
      startTime: new Date(),
      severity,
      description: description || `${userReport ? 'User reported' : 'Manual'} outage for ${isp.name}`,
      affectedRegions,
      source: userReport ? 'user_report' : 'manual',
      impactScore: calculateImpactScore(severity, affectedRegions.length)
    });

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

    const outage = await NetworkOutage.findByPk(outageId);
    if (!outage) {
      return res.status(404).json({ error: 'Outage not found' });
    }

    if (outage.isResolved) {
      return res.status(400).json({ error: 'Outage already resolved' });
    }

    await outage.update({
      endTime: new Date(),
      isResolved: true,
      description: resolution || outage.description
    });

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

    // Recent test metrics
    const recentTests = await SpeedTest.findOne({
      where: {
        createdAt: { [Op.gte]: oneHourAgo }
      },
      attributes: [
        [require('sequelize').fn('COUNT', '*'), 'count'],
        [require('sequelize').fn('AVG', require('sequelize').col('downloadSpeed')), 'avgDownload'],
        [require('sequelize').fn('AVG', require('sequelize').col('latency')), 'avgLatency']
      ],
      raw: true
    });

    // Active outages
    const activeOutages = await NetworkOutage.count({
      where: { isResolved: false }
    });

    // ISP performance summary
    const ispSummary = await ISP.findOne({
      attributes: [
        [require('sequelize').fn('COUNT', '*'), 'totalIsps'],
        [require('sequelize').fn('AVG', require('sequelize').col('reliabilityScore')), 'avgReliability']
      ],
      where: { isActive: true },
      raw: true
    });

    // Daily test volume
    const dailyVolume = await SpeedTest.count({
      where: {
        createdAt: { [Op.gte]: oneDayAgo }
      }
    });

    const health = {
      status: activeOutages === 0 ? 'healthy' : activeOutages < 5 ? 'warning' : 'critical',
      metrics: {
        recentTests: parseInt(recentTests?.count) || 0,
        averageDownload: parseFloat(recentTests?.avgDownload) || 0,
        averageLatency: parseFloat(recentTests?.avgLatency) || 0,
        activeOutages,
        totalIsps: parseInt(ispSummary?.totalIsps) || 0,
        averageReliability: parseFloat(ispSummary?.avgReliability) || 0,
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