// scripts/migrate-database-schema.js
// Migration script to update existing data to new schema format
const mongoose = require('mongoose');
require('dotenv').config();

async function migrateDatabase() {
  console.log('🔄 Starting Database Schema Migration');
  console.log('=====================================\n');

  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/netpulse';
    console.log('📡 Connecting to database...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get database handle
    const db = mongoose.connection.db;

    // Step 1: Drop duplicate indexes
    console.log('Step 1: Removing duplicate indexes');
    console.log('-----------------------------------');
    
    await dropDuplicateIndexes(db);
    
    // Step 2: Update ISP schema
    console.log('\nStep 2: Updating ISP collection');
    console.log('--------------------------------');
    
    await migrateISPCollection(db);
    
    // Step 3: Update UserSession schema
    console.log('\nStep 3: Updating UserSession collection');
    console.log('----------------------------------------');
    
    await migrateUserSessionCollection(db);
    
    // Step 4: Update SpeedTest schema
    console.log('\nStep 4: Updating SpeedTest collection');
    console.log('--------------------------------------');
    
    await migrateSpeedTestCollection(db);
    
    // Step 5: Create new indexes
    console.log('\nStep 5: Creating optimized indexes');
    console.log('----------------------------------');
    
    await createOptimizedIndexes(db);
    
    // Step 6: Validate migration
    console.log('\nStep 6: Validating migration');
    console.log('----------------------------');
    
    await validateMigration(db);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('====================================\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from database');
  }
}

async function dropDuplicateIndexes(db) {
  const collections = ['isps', 'usersessions', 'speedtests'];
  
  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      const indexes = await collection.indexes();
      
      console.log(`\n📋 Current indexes in ${collectionName}:`);
      indexes.forEach(index => {
        console.log(`   - ${index.name}`);
      });
      
      // Drop all non-_id indexes - they will be recreated
      for (const index of indexes) {
        if (index.name !== '_id_') {
          try {
            await collection.dropIndex(index.name);
            console.log(`   ✅ Dropped: ${index.name}`);
          } catch (error) {
            if (!error.message.includes('index not found')) {
              console.warn(`   ⚠️  Could not drop ${index.name}: ${error.message}`);
            }
          }
        }
      }
      
    } catch (error) {
      console.warn(`⚠️  Collection ${collectionName} may not exist yet`);
    }
  }
}

async function migrateISPCollection(db) {
  const collection = db.collection('isps');
  const count = await collection.countDocuments();
  
  console.log(`Found ${count} ISP documents`);
  
  if (count === 0) {
    console.log('⚠️  No ISPs to migrate');
    return;
  }
  
  // Add new fields to existing documents
  const updates = {
    $set: {
      'statistics.averageJitter': 0,
      'statistics.averagePacketLoss': 0,
      'metadata': {}
    },
    $setOnInsert: {
      lastUpdated: new Date(),
      isActive: true
    }
  };
  
  const result = await collection.updateMany({}, updates);
  console.log(`✅ Updated ${result.modifiedCount} ISP documents`);
  
  // Recalculate reliability scores
  const isps = await collection.find({}).toArray();
  let recalculated = 0;
  
  for (const isp of isps) {
    const reliabilityScore = calculateReliabilityScore(isp.statistics);
    await collection.updateOne(
      { _id: isp._id },
      { $set: { 'statistics.reliabilityScore': reliabilityScore } }
    );
    recalculated++;
  }
  
  console.log(`✅ Recalculated reliability for ${recalculated} ISPs`);
}

async function migrateUserSessionCollection(db) {
  const collection = db.collection('usersessions');
  const count = await collection.countDocuments();
  
  console.log(`Found ${count} UserSession documents`);
  
  if (count === 0) {
    console.log('⚠️  No sessions to migrate');
    return;
  }
  
  // Add new fields
  const updates = {
    $set: {
      'deviceInfo': {},
      'testCount.lastHour': 0,
      'testCount.lastDay': 0,
      'testCount.lastResetHour': new Date(),
      'testCount.lastResetDay': new Date(),
      'consentGiven': false,
      'dataRetentionConsent': true,
      'sessionDuration': 0
    },
    $setOnInsert: {
      firstSeen: new Date(),
      isActive: true
    }
  };
  
  const result = await collection.updateMany({}, updates);
  console.log(`✅ Updated ${result.modifiedCount} UserSession documents`);
}

async function migrateSpeedTestCollection(db) {
  const collection = db.collection('speedtests');
  const count = await collection.countDocuments();
  
  console.log(`Found ${count} SpeedTest documents`);
  
  if (count === 0) {
    console.log('⚠️  No speed tests to migrate');
    return;
  }
  
  // Migrate raw results to new format
  console.log('Migrating raw results format...');
  
  const tests = await collection.find({ rawResults: { $exists: true } }).toArray();
  let migrated = 0;
  
  for (const test of tests) {
    const newRawResults = {
      downloadSamples: extractSamples(test.rawResults?.downloadSamples),
      uploadSamples: extractSamples(test.rawResults?.uploadSamples),
      latencySamples: extractSamples(test.rawResults?.latencySamples),
      metadata: {
        serverId: test.testServerId,
        duration: test.testDuration,
        stages: test.rawResults?.comprehensive?.stages || 0,
        reliability: test.rawResults?.comprehensive?.reliability || 0,
        testId: test._id.toString()
      }
    };
    
    const updates = {
      $set: {
        rawResults: newRawResults,
        isValid: true,
        isSuspicious: false,
        downloadConsistency: 0,
        uploadConsistency: 0
      }
    };
    
    // Add quality grade if missing
    if (!test.qualityGrade && test.qualityScore) {
      updates.$set.qualityGrade = getQualityGrade(test.qualityScore);
    }
    
    await collection.updateOne({ _id: test._id }, updates);
    migrated++;
  }
  
  console.log(`✅ Migrated ${migrated} SpeedTest documents`);
  
  // Validate and flag suspicious tests
  console.log('Validating test results...');
  
  await collection.updateMany(
    {
      $or: [
        { downloadSpeed: { $gt: 10000 } },
        { uploadSpeed: { $gt: 5000 } },
        { latency: { $lt: 0.1 } },
        { latency: { $gt: 1000 } },
        { packetLoss: { $gt: 50 } }
      ]
    },
    { $set: { isSuspicious: true, validationNotes: 'Unusual values detected' } }
  );
  
  console.log('✅ Flagged suspicious tests');
}

async function createOptimizedIndexes(db) {
  // ISP indexes
  console.log('\n📊 Creating ISP indexes...');
  const ispCollection = db.collection('isps');
  
  await Promise.all([
    ispCollection.createIndex({ name: 1 }, { unique: true }),
    ispCollection.createIndex({ country: 1, isActive: 1 }),
    ispCollection.createIndex({ country: 1, 'statistics.averageDownload': -1 }),
    ispCollection.createIndex({ country: 1, 'statistics.reliabilityScore': -1 }),
    ispCollection.createIndex({ 'statistics.averageDownload': -1 }),
    ispCollection.createIndex({ 'statistics.reliabilityScore': -1 }),
    ispCollection.createIndex({ asn: 1 }, { unique: true, sparse: true }),
    ispCollection.createIndex({ lastUpdated: -1 }),
    ispCollection.createIndex({ name: 'text', displayName: 'text' })
  ]);
  
  console.log('✅ ISP indexes created');
  
  // UserSession indexes
  console.log('\n📊 Creating UserSession indexes...');
  const sessionCollection = db.collection('usersessions');
  
  await Promise.all([
    sessionCollection.createIndex({ sessionToken: 1 }, { unique: true }),
    sessionCollection.createIndex({ ipAddress: 1 }),
    sessionCollection.createIndex({ lastActivity: -1 }),
    sessionCollection.createIndex({ isActive: 1, lastActivity: -1 }),
    sessionCollection.createIndex({ deviceFingerprint: 1 }),
    sessionCollection.createIndex({ ipAddress: 1, isActive: 1 }),
    sessionCollection.createIndex({ 'location.country': 1, createdAt: -1 }),
    sessionCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 })
  ]);
  
  console.log('✅ UserSession indexes created');
  
  // SpeedTest indexes
  console.log('\n📊 Creating SpeedTest indexes...');
  const speedTestCollection = db.collection('speedtests');
  
  await Promise.all([
    speedTestCollection.createIndex({ createdAt: -1 }),
    speedTestCollection.createIndex({ ispId: 1 }),
    speedTestCollection.createIndex({ sessionId: 1 }),
    speedTestCollection.createIndex({ qualityScore: -1 }),
    speedTestCollection.createIndex({ networkType: 1 }),
    speedTestCollection.createIndex({ 'location.country': 1 }),
    speedTestCollection.createIndex({ ispId: 1, createdAt: -1 }),
    speedTestCollection.createIndex({ sessionId: 1, createdAt: -1 }),
    speedTestCollection.createIndex({ 'location.country': 1, createdAt: -1 }),
    speedTestCollection.createIndex({ qualityScore: -1, createdAt: -1 }),
    speedTestCollection.createIndex({ networkType: 1, createdAt: -1 }),
    speedTestCollection.createIndex({ isValid: 1, isSuspicious: 1, createdAt: -1 }),
    speedTestCollection.createIndex({ testServerId: 1, createdAt: -1 }),
    speedTestCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 })
  ]);
  
  console.log('✅ SpeedTest indexes created');
}

async function validateMigration(db) {
  console.log('\n🔍 Running validation checks...');
  
  // Check ISP collection
  const ispCollection = db.collection('isps');
  const ispCount = await ispCollection.countDocuments();
  const ispIndexes = await ispCollection.indexes();
  console.log(`✅ ISPs: ${ispCount} documents, ${ispIndexes.length} indexes`);
  
  // Check UserSession collection
  const sessionCollection = db.collection('usersessions');
  const sessionCount = await sessionCollection.countDocuments();
  const sessionIndexes = await sessionCollection.indexes();
  console.log(`✅ UserSessions: ${sessionCount} documents, ${sessionIndexes.length} indexes`);
  
  // Check SpeedTest collection
  const speedTestCollection = db.collection('speedtests');
  const speedTestCount = await speedTestCollection.countDocuments();
  const speedTestIndexes = await speedTestCollection.indexes();
  console.log(`✅ SpeedTests: ${speedTestCount} documents, ${speedTestIndexes.length} indexes`);
  
  // Check for suspicious tests
  const suspiciousCount = await speedTestCollection.countDocuments({ isSuspicious: true });
  console.log(`⚠️  Suspicious tests flagged: ${suspiciousCount}`);
  
  console.log('\n✅ Validation complete');
}

// Helper functions
function extractSamples(samples) {
  if (!samples) return [];
  if (Array.isArray(samples)) {
    // If already an array of numbers, return as is
    if (typeof samples[0] === 'number') return samples;
    // If array of objects, extract speed values
    return samples.map(s => s.speed || s.value || 0).filter(v => v > 0);
  }
  return [];
}

function calculateReliabilityScore(stats) {
  if (!stats) return 0;
  
  const downloadScore = Math.min(100, (stats.averageDownload / 100) * 30);
  const uploadScore = Math.min(100, (stats.averageUpload / 50) * 20);
  const latencyScore = Math.max(0, 100 - stats.averageLatency) * 0.25;
  const jitterScore = Math.max(0, 100 - ((stats.averageJitter || 0) * 2)) * 0.15;
  const packetLossScore = Math.max(0, 100 - ((stats.averagePacketLoss || 0) * 10)) * 0.10;
  
  return Math.min(100, downloadScore + uploadScore + latencyScore + jitterScore + packetLossScore);
}

function getQualityGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}

// Run migration
if (require.main === module) {
  migrateDatabase()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateDatabase };
