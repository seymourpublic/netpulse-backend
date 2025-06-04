
const dbConnection = require('../db/connection');
const { ISP, SpeedTest, UserSession } = require('../models');

async function setupAtlasData() {
  try {
    console.log('🌩️  NETPULSE MongoDB Atlas Setup');
    console.log('==================================\n');
    
    // Connect to Atlas
    await dbConnection.connect();
    
    const status = dbConnection.getConnectionStatus();
    console.log('📊 Connection Status:', status);
    
    if (!status.isConnected) {
      throw new Error('Failed to connect to MongoDB Atlas');
    }
    
    // Check existing data
    console.log('\n📋 Checking existing data...');
    const counts = {
      isps: await ISP.countDocuments(),
      speedTests: await SpeedTest.countDocuments(),
      sessions: await UserSession.countDocuments()
    };
    
    console.log(`📊 Current data: ${counts.isps} ISPs, ${counts.speedTests} speed tests, ${counts.sessions} sessions`);
    
    if (counts.isps === 0) {
      console.log('\n🌱 No ISP data found. Creating sample data...');
      await createSampleISPs();
      
      console.log('📊 Creating sample speed test data...');
      await createSampleSpeedTests();
      
    } else {
      console.log('✅ Data already exists in Atlas cluster');
      await displayExistingData();
    }
    
    // Verify the data is accessible
    await verifyDataAccess();
    
    console.log('\n🎉 Atlas setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Atlas setup failed:', error);
    
    if (error.message.includes('authentication failed')) {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('   1. Username and password in MONGODB_URI');
      console.log('   2. Database user permissions');
      console.log('   3. IP whitelist in Atlas dashboard');
    }
    
    if (error.message.includes('network') || error.message.includes('timeout')) {
      console.log('\n💡 Network error. Please check:');
      console.log('   1. Internet connection');
      console.log('   2. Atlas cluster is running');
      console.log('   3. IP address is whitelisted (or use 0.0.0.0/0 for testing)');
    }
    
  } finally {
    await dbConnection.disconnect();
  }
}

async function createSampleISPs() {
  const sampleISPs = [
    {
      name: 'Rocket Internet',
      displayName: 'Rocket Internet',
      country: 'ZA',
      region: 'Gauteng',
      statistics: {
        averageDownload: 220.4,
        averageUpload: 35.7,
        averageLatency: 12.8,
        reliabilityScore: 96.2,
        totalTests: 428
      },
      isActive: true
    },
    {
      name: 'Afrihost',
      displayName: 'Afrihost',
      country: 'ZA',
      region: 'National',
      statistics: {
        averageDownload: 180.5,
        averageUpload: 22.3,
        averageLatency: 15.2,
        reliabilityScore: 94.8,
        totalTests: 1247
      },
      isActive: true
    },
    {
      name: 'Cool Ideas',
      displayName: 'Cool Ideas',
      country: 'ZA',
      region: 'Western Cape',
      statistics: {
        averageDownload: 195.7,
        averageUpload: 31.2,
        averageLatency: 14.1,
        reliabilityScore: 93.6,
        totalTests: 743
      },
      isActive: true
    },
    {
      name: 'Telkom',
      displayName: 'Telkom SA',
      country: 'ZA',
      region: 'National',
      statistics: {
        averageDownload: 145.2,
        averageUpload: 18.7,
        averageLatency: 18.9,
        reliabilityScore: 89.2,
        totalTests: 2156
      },
      isActive: true
    },
    {
      name: 'Webafrica',
      displayName: 'Web Africa',
      country: 'ZA',
      region: 'Western Cape',
      statistics: {
        averageDownload: 165.8,
        averageUpload: 20.1,
        averageLatency: 16.7,
        reliabilityScore: 91.5,
        totalTests: 856
      },
      isActive: true
    }
  ];

  for (const ispData of sampleISPs) {
    await ISP.findOneAndUpdate(
      { name: ispData.name },
      ispData,
      { upsert: true, new: true }
    );
    console.log(`   ✅ Created/updated: ${ispData.displayName}`);
  }
  
  console.log(`✅ Created ${sampleISPs.length} ISPs in Atlas`);
}

async function createSampleSpeedTests() {
  // Create a sample session
  const session = new UserSession({
    sessionToken: 'atlas-demo-session',
    ipAddress: '41.76.108.46',
    userAgent: 'Atlas Demo Data',
    location: {
      city: 'Johannesburg',
      country: 'ZA',
      region: 'Gauteng',
      lat: -26.2041,
      lng: 28.0473,
      timezone: 'Africa/Johannesburg'
    }
  });
  
  await session.save();
  
  // Get ISPs
  const isps = await ISP.find({ isActive: true });
  const speedTests = [];
  
  for (const isp of isps) {
    // Create 5-10 sample speed tests per ISP
    const numTests = Math.floor(Math.random() * 6) + 5;
    
    for (let i = 0; i < numTests; i++) {
      const baseDownload = isp.statistics.averageDownload;
      const baseUpload = isp.statistics.averageUpload;
      const baseLatency = isp.statistics.averageLatency;
      
      speedTests.push({
        downloadSpeed: baseDownload + (Math.random() - 0.5) * 40,
        uploadSpeed: baseUpload + (Math.random() - 0.5) * 10,
        latency: baseLatency + (Math.random() - 0.5) * 10,
        jitter: Math.random() * 5 + 1,
        packetLoss: Math.random() * 2,
        testDuration: 15000,
        ipAddress: '41.76.108.46',
        userAgent: 'Atlas Demo',
        networkType: 'ethernet',
        location: session.location,
        qualityScore: Math.random() * 40 + 60, // 60-100
        ispId: isp._id,
        sessionId: session._id,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
      });
    }
  }
  
  await SpeedTest.insertMany(speedTests);
  console.log(`✅ Created ${speedTests.length} sample speed tests in Atlas`);
}

async function displayExistingData() {
  console.log('\n📊 Existing Data Overview:');
  
  const isps = await ISP.find({ isActive: true })
    .select('name displayName statistics')
    .sort({ 'statistics.averageDownload': -1 })
    .limit(5);
    
  console.log('\n🏆 Top 5 ISPs by Download Speed:');
  isps.forEach((isp, index) => {
    console.log(`   ${index + 1}. ${isp.displayName} - ${isp.statistics?.averageDownload || 0} Mbps`);
  });
  
  const recentTests = await SpeedTest.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });
  
  console.log(`\n📈 Speed tests in last 7 days: ${recentTests}`);
}

async function verifyDataAccess() {
  console.log('\n🔍 Verifying data access...');
  
  try {
    // Test ISP rankings query (same as API endpoint)
    const rankings = await ISP.find({ 
      country: 'ZA',
      isActive: true 
    })
    .select('name displayName statistics')
    .sort({ 'statistics.averageDownload': -1 })
    .limit(5);
    
    if (rankings.length > 0) {
      console.log('✅ ISP rankings query works');
      console.log(`   Found ${rankings.length} ISPs`);
    } else {
      console.log('❌ ISP rankings query returned no results');
    }
    
    // Test speed test query
    const testCount = await SpeedTest.countDocuments();
    console.log(`✅ Speed test collection accessible: ${testCount} records`);
    
  } catch (error) {
    console.error('❌ Data access verification failed:', error.message);
  }
}

// 4. Test Atlas Connection
async function testAtlasConnection() {
  console.log('🧪 Testing MongoDB Atlas Connection\n');
  
  try {
    await dbConnection.connect();
    
    const status = dbConnection.getConnectionStatus();
    console.log('📊 Connection Details:');
    console.log(`   Status: ${status.status}`);
    console.log(`   Host: ${status.host}`);
    console.log(`   Database: ${status.name}`);
    
    // Test basic operations
    console.log('\n⚡ Testing basic operations...');
    
    // Count documents
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`✅ Found ${collections.length} collections:`, collections.map(c => c.name));
    
    // Test ISP collection
    const ispCount = await ISP.countDocuments();
    console.log(`✅ ISPs collection: ${ispCount} documents`);
    
    const speedTestCount = await SpeedTest.countDocuments();
    console.log(`✅ SpeedTests collection: ${speedTestCount} documents`);
    
    console.log('\n🎉 Atlas connection test successful!');
    
  } catch (error) {
    console.error('❌ Atlas connection test failed:', error.message);
    
    if (error.message.includes('MONGODB_URI')) {
      console.log('\n💡 MONGODB_URI environment variable not found or invalid');
      console.log('   Make sure you have a .env file with your Atlas connection string');
    }
  } finally {
    await dbConnection.disconnect();
  }
}

if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'test') {
    testAtlasConnection();
  } else {
    setupAtlasData();
  }
}

module.exports = { setupAtlasData, testAtlasConnection, dbConnection };