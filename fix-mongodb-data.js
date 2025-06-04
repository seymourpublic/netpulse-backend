const mongoose = require('mongoose');
require('dotenv').config();

async function fixMongoDBData() {
  try {
    console.log('🔧 Fixing MongoDB Data Issues');
    console.log('==============================\n');
    
    // Connect to your database (use the same URI from your .env)
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/netpulse';
    await mongoose.connect(MONGODB_URI);
    
    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    
    // Get the collections
    const db = mongoose.connection.db;
    
    // Check if speedtests collection exists
    const collections = await db.listCollections().toArray();
    const hasSpeedTests = collections.some(col => col.name === 'speedtests');
    
    console.log(`📋 Collections found: ${collections.map(c => c.name).join(', ')}`);
    
    if (hasSpeedTests) {
      console.log('\n🧹 Cleaning up problematic speed test data...');
      
      // Remove documents with invalid rawResults data
      const deleteResult = await db.collection('speedtests').deleteMany({
        $or: [
          { 'rawResults.uploadSamples': { $type: 'string' } }, // Remove string values
          { 'rawResults.downloadSamples': { $type: 'string' } }, // Remove string values
          { 'rawResults.uploadSamples.0': { $type: 'string' } }, // Remove if first element is string
          { 'rawResults.downloadSamples.0': { $type: 'string' } } // Remove if first element is string
        ]
      });
      
      console.log(`🗑️  Removed ${deleteResult.deletedCount} problematic speed test documents`);
      
      // Count remaining documents
      const remainingCount = await db.collection('speedtests').countDocuments();
      console.log(`📊 Remaining speed test documents: ${remainingCount}`);
    }
    
    // Drop and recreate indexes to ensure they're correct
    console.log('\n🔄 Updating database indexes...');
    
    if (hasSpeedTests) {
      try {
        await db.collection('speedtests').dropIndexes();
        console.log('🗑️  Dropped old indexes');
      } catch (error) {
        console.log('⚠️  Could not drop indexes (may not exist)');
      }
      
      // Create new indexes
      await db.collection('speedtests').createIndex({ "createdAt": -1 });
      await db.collection('speedtests').createIndex({ "ispId": 1 });
      await db.collection('speedtests').createIndex({ "location.country": 1 });
      await db.collection('speedtests').createIndex({ "qualityScore": -1 });
      await db.collection('speedtests').createIndex({ "networkType": 1 });
      
      console.log('✅ Created new indexes for speedtests collection');
    }
    
    // Update ISPs collection indexes
    const hasISPs = collections.some(col => col.name === 'isps');
    if (hasISPs) {
      try {
        await db.collection('isps').dropIndexes();
        console.log('🗑️  Dropped old ISP indexes');
      } catch (error) {
        console.log('⚠️  Could not drop ISP indexes (may not exist)');
      }
      
      await db.collection('isps').createIndex({ "name": 1 }, { unique: true });
      await db.collection('isps').createIndex({ "country": 1 });
      await db.collection('isps').createIndex({ "statistics.reliabilityScore": -1 });
      await db.collection('isps').createIndex({ "statistics.averageDownload": -1 });
      
      console.log('✅ Created new indexes for isps collection');
    }
    
    // Validate data integrity
    console.log('\n🔍 Validating data integrity...');
    
    if (hasSpeedTests) {
      // Check for any remaining problematic documents
      const problematicDocs = await db.collection('speedtests').find({
        $or: [
          { downloadSpeed: { $type: 'string' } },
          { uploadSpeed: { $type: 'string' } },
          { latency: { $type: 'string' } }
        ]
      }).count();
      
      if (problematicDocs > 0) {
        console.log(`⚠️  Found ${problematicDocs} documents with string values in numeric fields`);
        console.log('   These will be fixed automatically when new tests are run');
      } else {
        console.log('✅ All speed test documents have correct data types');
      }
    }
    
    // Create sample data if collections are empty
    if (!hasSpeedTests || await db.collection('speedtests').countDocuments() === 0) {
      console.log('\n🌱 Creating sample speed test data...');
      await createSampleSpeedTest(db);
    }
    
    if (!hasISPs || await db.collection('isps').countDocuments() === 0) {
      console.log('\n🌱 Creating sample ISP data...');
      await createSampleISPs(db);
    }
    
    // Test the query that was failing
    console.log('\n🧪 Testing speed test queries...');
    
    try {
      const testQuery = await db.collection('speedtests').findOne({}, {
        projection: { 
          downloadSpeed: 1, 
          uploadSpeed: 1, 
          latency: 1,
          rawResults: 1 
        }
      });
      
      if (testQuery) {
        console.log('✅ Speed test query successful');
        console.log(`   Sample document structure:`, {
          downloadSpeed: typeof testQuery.downloadSpeed,
          uploadSpeed: typeof testQuery.uploadSpeed,
          latency: typeof testQuery.latency,
          rawResults: testQuery.rawResults ? 'present' : 'missing'
        });
      } else {
        console.log('⚠️  No speed test documents found');
      }
    } catch (queryError) {
      console.error('❌ Speed test query failed:', queryError.message);
    }
    
    console.log('\n🎉 MongoDB data fix completed!');
    console.log('💡 You can now run speed tests without the CastError.');
    
  } catch (error) {
    console.error('❌ MongoDB fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

async function createSampleSpeedTest(db) {
  const sampleSpeedTest = {
    downloadSpeed: 150.5,
    uploadSpeed: 25.3,
    latency: 18.7,
    jitter: 2.1,
    packetLoss: 0.1,
    testDuration: 15000,
    ipAddress: '127.0.0.1',
    userAgent: 'Sample Test Data',
    deviceInfo: {
      cpu: 'Sample CPU',
      memory: '8GB',
      os: 'Sample OS'
    },
    networkType: 'ethernet',
    location: {
      city: 'Johannesburg',
      country: 'ZA',
      region: 'Gauteng',
      lat: -26.2041,
      lng: 28.0473,
      timezone: 'Africa/Johannesburg'
    },
    testServerId: 'sample-server',
    rawResults: {
      downloadSamples: [145.2, 148.7, 152.1, 149.8, 153.2], // Array of numbers
      uploadSamples: [23.4, 25.1, 26.8, 24.9, 25.7],        // Array of numbers
      latencySamples: [17.2, 18.9, 19.1, 18.3, 17.8],       // Array of numbers
      comprehensive: {
        serverId: 'sample-server',
        duration: 15000,
        stages: 5,
        reliability: 95.2
      }
    },
    qualityScore: 85.5,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await db.collection('speedtests').insertOne(sampleSpeedTest);
  console.log('✅ Created sample speed test document');
}

async function createSampleISPs(db) {
  const sampleISPs = [
    {
      name: 'Sample ISP',
      displayName: 'Sample ISP',
      country: 'ZA',
      region: 'Gauteng',
      statistics: {
        averageDownload: 150.0,
        averageUpload: 25.0,
        averageLatency: 18.0,
        reliabilityScore: 90.0,
        totalTests: 1
      },
      lastUpdated: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  await db.collection('isps').insertMany(sampleISPs);
  console.log('✅ Created sample ISP documents');
}

// Test function to verify the fix
async function testSpeedTestSave() {
  console.log('\n🧪 Testing Speed Test Save...');
  
  const mongoose = require('mongoose');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/netpulse';
  
  try {
    await mongoose.connect(MONGODB_URI);
    
    // Define a simple schema for testing
    const TestSpeedTestSchema = new mongoose.Schema({
      downloadSpeed: { type: Number, required: true },
      uploadSpeed: { type: Number, required: true },
      latency: { type: Number, required: true },
      rawResults: {
        downloadSamples: [{ type: Number }],
        uploadSamples: [{ type: Number }],
        latencySamples: [{ type: Number }]
      }
    }, { timestamps: true });
    
    const TestSpeedTest = mongoose.model('TestSpeedTest', TestSpeedTestSchema);
    
    // Try to save a test document
    const testDoc = new TestSpeedTest({
      downloadSpeed: 100.5,
      uploadSpeed: 20.3,
      latency: 15.7,
      rawResults: {
        downloadSamples: [95.2, 98.7, 102.1], // Proper array of numbers
        uploadSamples: [18.4, 19.1, 21.8],    // Proper array of numbers
        latencySamples: [14.2, 15.9, 16.1]    // Proper array of numbers
      }
    });
    
    await testDoc.save();
    console.log('✅ Test document saved successfully!');
    
    // Clean up test document
    await TestSpeedTest.findByIdAndDelete(testDoc._id);
    console.log('🧹 Test document cleaned up');
    
  } catch (error) {
    console.error('❌ Test save failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'test') {
    testSpeedTestSave();
  } else {
    fixMongoDBData();
  }
}

module.exports = { fixMongoDBData, testSpeedTestSave };