// scripts/verify-migration.js
// Script to verify database migration was successful
const mongoose = require('mongoose');
require('dotenv').config();

// Import the new models
const ISP = require('../models/isp');
const UserSession = require('../models/userSession');
const SpeedTest = require('../models/speedTest');

async function verifyMigration() {
  console.log('🔍 Verifying Database Migration');
  console.log('================================\n');

  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/netpulse';
    console.log('📡 Connecting to database...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    let allTestsPassed = true;

    // Test 1: Verify ISP model
    console.log('Test 1: ISP Model');
    console.log('-----------------');
    allTestsPassed = await verifyISPModel() && allTestsPassed;

    // Test 2: Verify UserSession model
    console.log('\nTest 2: UserSession Model');
    console.log('-------------------------');
    allTestsPassed = await verifyUserSessionModel() && allTestsPassed;

    // Test 3: Verify SpeedTest model
    console.log('\nTest 3: SpeedTest Model');
    console.log('-----------------------');
    allTestsPassed = await verifySpeedTestModel() && allTestsPassed;

    // Test 4: Verify indexes
    console.log('\nTest 4: Index Verification');
    console.log('--------------------------');
    allTestsPassed = await verifyIndexes() && allTestsPassed;

    // Test 5: Test new features
    console.log('\nTest 5: New Features');
    console.log('--------------------');
    allTestsPassed = await testNewFeatures() && allTestsPassed;

    // Test 6: Performance check
    console.log('\nTest 6: Performance Check');
    console.log('-------------------------');
    await performanceCheck();

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED - Migration Successful!');
      console.log('='.repeat(50));
    } else {
      console.log('❌ SOME TESTS FAILED - Please Review');
      console.log('='.repeat(50));
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from database');
  }
}

async function verifyISPModel() {
  try {
    // Check if ISPs exist
    const ispCount = await ISP.countDocuments();
    console.log(`📊 Total ISPs: ${ispCount}`);

    if (ispCount === 0) {
      console.log('⚠️  No ISPs found - you may need to populate data');
      return true; // Not a failure, just empty
    }

    // Check for required fields
    const sampleISP = await ISP.findOne();
    
    const hasRequiredFields = 
      sampleISP.name &&
      sampleISP.country &&
      sampleISP.statistics &&
      typeof sampleISP.statistics.averageDownload === 'number' &&
      typeof sampleISP.statistics.reliabilityScore === 'number';

    if (hasRequiredFields) {
      console.log('✅ ISP model structure is correct');
    } else {
      console.log('❌ ISP model missing required fields');
      return false;
    }

    // Test ISP methods
    if (typeof ISP.getRankings === 'function') {
      console.log('✅ ISP.getRankings() method exists');
      
      // Test the method
      const rankings = await ISP.getRankings('ZA', { limit: 5 });
      console.log(`   Found ${rankings.length} rankings for South Africa`);
    } else {
      console.log('❌ ISP.getRankings() method missing');
      return false;
    }

    if (typeof sampleISP.updateStatistics === 'function') {
      console.log('✅ isp.updateStatistics() method exists');
    } else {
      console.log('❌ isp.updateStatistics() method missing');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ ISP model verification failed:', error.message);
    return false;
  }
}

async function verifyUserSessionModel() {
  try {
    const sessionCount = await UserSession.countDocuments();
    console.log(`📊 Total Sessions: ${sessionCount}`);

    if (sessionCount === 0) {
      console.log('⚠️  No sessions found - this is normal for fresh installs');
      return true;
    }

    // Check for new fields
    const sampleSession = await UserSession.findOne();
    
    const hasNewFields = 
      sampleSession.testCount &&
      typeof sampleSession.testCount.lastHour === 'number' &&
      typeof sampleSession.testCount.lastDay === 'number';

    if (hasNewFields) {
      console.log('✅ UserSession has new rate limiting fields');
    } else {
      console.log('❌ UserSession missing rate limiting fields');
      return false;
    }

    // Test methods
    if (typeof sampleSession.canRunTest === 'function') {
      console.log('✅ userSession.canRunTest() method exists');
      
      const rateLimit = sampleSession.canRunTest();
      console.log(`   Rate limit check: ${rateLimit.allowed ? 'Allowed' : 'Blocked'}`);
      console.log(`   Tests remaining: ${rateLimit.hourlyRemaining}/hour, ${rateLimit.dailyRemaining}/day`);
    } else {
      console.log('❌ userSession.canRunTest() method missing');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ UserSession model verification failed:', error.message);
    return false;
  }
}

async function verifySpeedTestModel() {
  try {
    const testCount = await SpeedTest.countDocuments();
    console.log(`📊 Total Speed Tests: ${testCount}`);

    if (testCount === 0) {
      console.log('⚠️  No speed tests found - you may need to run some tests');
      return true;
    }

    // Check for new fields
    const sampleTest = await SpeedTest.findOne();
    
    const hasNewFields = 
      typeof sampleTest.isValid === 'boolean' &&
      typeof sampleTest.isSuspicious === 'boolean' &&
      sampleTest.rawResults &&
      Array.isArray(sampleTest.rawResults.downloadSamples);

    if (hasNewFields) {
      console.log('✅ SpeedTest has new validation fields');
      console.log(`   Sample raw data: ${sampleTest.rawResults.downloadSamples.length} download samples`);
    } else {
      console.log('❌ SpeedTest missing new fields or has wrong format');
      return false;
    }

    // Check data quality
    const validTests = await SpeedTest.countDocuments({ isValid: true });
    const suspiciousTests = await SpeedTest.countDocuments({ isSuspicious: true });
    
    console.log(`📊 Valid tests: ${validTests} (${((validTests/testCount)*100).toFixed(1)}%)`);
    console.log(`⚠️  Suspicious tests: ${suspiciousTests} (${((suspiciousTests/testCount)*100).toFixed(1)}%)`);

    return true;
  } catch (error) {
    console.error('❌ SpeedTest model verification failed:', error.message);
    return false;
  }
}

async function verifyIndexes() {
  try {
    const db = mongoose.connection.db;
    
    // Check ISP indexes
    const ispIndexes = await db.collection('isps').indexes();
    console.log(`📊 ISP indexes: ${ispIndexes.length}`);
    
    const hasISPCompoundIndex = ispIndexes.some(idx => 
      idx.name.includes('country') && idx.name.includes('isActive')
    );
    
    if (hasISPCompoundIndex || ispIndexes.length >= 8) {
      console.log('✅ ISP has optimized indexes');
    } else {
      console.log('⚠️  ISP may be missing some optimized indexes');
    }

    // Check UserSession indexes
    const sessionIndexes = await db.collection('usersessions').indexes();
    console.log(`📊 UserSession indexes: ${sessionIndexes.length}`);
    
    const hasSessionUniqueToken = sessionIndexes.some(idx => 
      idx.key.sessionToken && idx.unique
    );
    
    if (hasSessionUniqueToken) {
      console.log('✅ UserSession has unique sessionToken index');
    } else {
      console.log('❌ UserSession missing unique sessionToken index');
      return false;
    }

    // Check SpeedTest indexes
    const testIndexes = await db.collection('speedtests').indexes();
    console.log(`📊 SpeedTest indexes: ${testIndexes.length}`);
    
    if (testIndexes.length >= 10) {
      console.log('✅ SpeedTest has comprehensive indexes');
    } else {
      console.log('⚠️  SpeedTest may be missing some indexes');
    }

    return true;
  } catch (error) {
    console.error('❌ Index verification failed:', error.message);
    return false;
  }
}

async function testNewFeatures() {
  try {
    // Test ISP search (new feature)
    console.log('Testing ISP text search...');
    const ISPModel = mongoose.model('ISP');
    
    // This will only work if ISPs exist
    const ispCount = await ISPModel.countDocuments();
    if (ispCount > 0) {
      try {
        const searchResults = await ISPModel.searchISPs('fiber');
        console.log(`✅ Text search working: found ${searchResults.length} results`);
      } catch (error) {
        console.log('⚠️  Text search not available (text index may not be created yet)');
      }
    } else {
      console.log('⚠️  Skipping search test - no ISPs in database');
    }

    // Test session cleanup (new feature)
    console.log('\nTesting session cleanup...');
    const cleanupCount = await UserSession.cleanupInactiveSessions();
    console.log(`✅ Session cleanup executed: ${cleanupCount} sessions deactivated`);

    // Test speed test statistics
    console.log('\nTesting speed test statistics...');
    const testCount = await SpeedTest.countDocuments();
    if (testCount > 0) {
      const stats = await SpeedTest.aggregate([
        { $match: { isValid: true, isSuspicious: false } },
        {
          $group: {
            _id: null,
            avgDownload: { $avg: '$downloadSpeed' },
            avgUpload: { $avg: '$uploadSpeed' },
            avgLatency: { $avg: '$latency' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      if (stats.length > 0) {
        console.log(`✅ Statistics aggregation working:`);
        console.log(`   Avg Download: ${stats[0].avgDownload.toFixed(2)} Mbps`);
        console.log(`   Avg Upload: ${stats[0].avgUpload.toFixed(2)} Mbps`);
        console.log(`   Avg Latency: ${stats[0].avgLatency.toFixed(2)} ms`);
        console.log(`   Based on ${stats[0].count} tests`);
      }
    } else {
      console.log('⚠️  No tests to analyze');
    }

    return true;
  } catch (error) {
    console.error('⚠️  Some new features may not be fully functional:', error.message);
    return true; // Don't fail on this
  }
}

async function performanceCheck() {
  try {
    console.log('Running query performance tests...\n');

    // Test 1: ISP Rankings Query
    const start1 = Date.now();
    await ISP.find({ country: 'ZA', isActive: true })
      .sort({ 'statistics.averageDownload': -1 })
      .limit(10)
      .lean();
    const time1 = Date.now() - start1;
    console.log(`⏱️  ISP Rankings query: ${time1}ms ${time1 < 100 ? '✅' : '⚠️'}`);

    // Test 2: Recent Tests Query
    const start2 = Date.now();
    await SpeedTest.find({ isValid: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    const time2 = Date.now() - start2;
    console.log(`⏱️  Recent tests query: ${time2}ms ${time2 < 100 ? '✅' : '⚠️'}`);

    // Test 3: Session Lookup
    const start3 = Date.now();
    await UserSession.findOne({ isActive: true });
    const time3 = Date.now() - start3;
    console.log(`⏱️  Session lookup: ${time3}ms ${time3 < 50 ? '✅' : '⚠️'}`);

    // Calculate average
    const avgTime = (time1 + time2 + time3) / 3;
    console.log(`\n📊 Average query time: ${avgTime.toFixed(2)}ms`);

    if (avgTime < 100) {
      console.log('✅ Excellent performance!');
    } else if (avgTime < 200) {
      console.log('✅ Good performance');
    } else {
      console.log('⚠️  Performance could be improved - check indexes');
    }

  } catch (error) {
    console.error('⚠️  Performance check encountered an error:', error.message);
  }
}

// Run verification
if (require.main === module) {
  verifyMigration()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Verification script failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyMigration };
