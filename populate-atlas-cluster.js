const mongoose = require('mongoose');
require('dotenv').config();

// Since your database is named 'test', we'll work with that
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/test?retryWrites=true&w=majority';

// Define schemas for your existing database structure
const ispSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  displayName: String,
  country: { type: String, required: true },
  region: String,
  asn: { type: Number, unique: true, sparse: true },
  website: String,
  statistics: {
    averageDownload: { type: Number, default: 0 },
    averageUpload: { type: Number, default: 0 },
    averageLatency: { type: Number, default: 0 },
    reliabilityScore: { type: Number, default: 0, min: 0, max: 100 },
    totalTests: { type: Number, default: 0 }
  },
  lastUpdated: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const speedTestSchema = new mongoose.Schema({
  downloadSpeed: { type: Number, required: true, min: 0 },
  uploadSpeed: { type: Number, required: true, min: 0 },
  latency: { type: Number, required: true, min: 0 },
  jitter: { type: Number, required: true, min: 0 },
  packetLoss: { type: Number, required: true, default: 0, min: 0, max: 100 },
  testDuration: { type: Number, required: true },
  ipAddress: { type: String, required: true },
  userAgent: String,
  deviceInfo: {
    cpu: String,
    memory: String,
    os: String,
    cores: Number
  },
  networkType: { type: String, enum: ['wifi', 'ethernet', 'mobile', 'unknown'], default: 'unknown' },
  location: {
    city: String,
    country: String,
    region: String,
    lat: Number,
    lng: Number,
    timezone: String
  },
  testServerId: String,
  qualityScore: { type: Number, min: 0, max: 100 },
  ispId: { type: mongoose.Schema.Types.ObjectId, ref: 'ISP' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserSession' }
}, { timestamps: true });

const userSessionSchema = new mongoose.Schema({
  sessionToken: { type: String, unique: true, required: true },
  ipAddress: { type: String, required: true },
  userAgent: String,
  location: {
    city: String,
    country: String,
    region: String,
    lat: Number,
    lng: Number,
    timezone: String
  },
  lastActivity: { type: Date, default: Date.now },
  totalTests: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

async function populateAtlasCluster() {
  try {
    console.log('🌍 Connecting to your Atlas cluster in Cape Town...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to Atlas cluster successfully!');
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    console.log(`🏠 Host: ${mongoose.connection.host}`);
    
    // Create models for the existing database
    const ISP = mongoose.model('ISP', ispSchema);
    const SpeedTest = mongoose.model('SpeedTest', speedTestSchema);
    const UserSession = mongoose.model('UserSession', userSessionSchema);
    
    // Check what collections already exist
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Existing collections:', collections.map(c => c.name));
    
    // Check current document counts
    const currentCounts = {
      isps: await ISP.countDocuments(),
      speedtests: await SpeedTest.countDocuments(),
      usersessions: await UserSession.countDocuments()
    };
    
    console.log('\n📊 Current document counts:');
    console.log(`   ISPs: ${currentCounts.isps}`);
    console.log(`   Speed Tests: ${currentCounts.speedtests}`);
    console.log(`   User Sessions: ${currentCounts.usersessions}`);
    
    // Create South African ISP data (Cape Town focused)
    console.log('\n🇿🇦 Creating South African ISP data...');
    
    const southAfricanISPs = [
      {
        name: 'Afrihost',
        displayName: 'Afrihost',
        country: 'ZA',
        region: 'National',
        asn: 36937,
        website: 'https://www.afrihost.com',
        statistics: {
          averageDownload: 185.3,
          averageUpload: 24.7,
          averageLatency: 14.8,
          reliabilityScore: 94.2,
          totalTests: 1534
        }
      },
      {
        name: 'Webafrica',
        displayName: 'Web Africa',
        country: 'ZA',
        region: 'Western Cape',
        asn: 37662,
        website: 'https://www.webafrica.co.za',
        statistics: {
          averageDownload: 168.9,
          averageUpload: 21.3,
          averageLatency: 16.2,
          reliabilityScore: 91.8,
          totalTests: 987
        }
      },
      {
        name: 'Cool Ideas',
        displayName: 'Cool Ideas',
        country: 'ZA',
        region: 'Western Cape',
        asn: 37721,
        website: 'https://www.coolideas.co.za',
        statistics: {
          averageDownload: 212.7,
          averageUpload: 35.4,
          averageLatency: 12.1,
          reliabilityScore: 96.1,
          totalTests: 743
        }
      },
      {
        name: 'Telkom',
        displayName: 'Telkom SA',
        country: 'ZA',
        region: 'National',
        asn: 37457,
        website: 'https://www.telkom.co.za',
        statistics: {
          averageDownload: 142.6,
          averageUpload: 19.8,
          averageLatency: 18.7,
          reliabilityScore: 88.9,
          totalTests: 2341
        }
      },
      {
        name: 'Vodacom',
        displayName: 'Vodacom SA',
        country: 'ZA',
        region: 'National',
        asn: 36874,
        website: 'https://www.vodacom.co.za',
        statistics: {
          averageDownload: 89.4,
          averageUpload: 31.2,
          averageLatency: 23.8,
          reliabilityScore: 85.3,
          totalTests: 4156
        }
      },
      {
        name: 'MTN',
        displayName: 'MTN South Africa',
        country: 'ZA',
        region: 'National',
        asn: 35658,
        website: 'https://www.mtn.co.za',
        statistics: {
          averageDownload: 94.7,
          averageUpload: 28.9,
          averageLatency: 21.5,
          reliabilityScore: 86.7,
          totalTests: 3892
        }
      },
      {
        name: 'MWEB',
        displayName: 'MWEB',
        country: 'ZA',
        region: 'National',
        asn: 10474,
        website: 'https://www.mweb.co.za',
        statistics: {
          averageDownload: 134.8,
          averageUpload: 17.3,
          averageLatency: 19.9,
          reliabilityScore: 87.2,
          totalTests: 1678
        }
      },
      {
        name: 'Rain',
        displayName: 'Rain Mobile',
        country: 'ZA',
        region: 'National',
        asn: 37178,
        website: 'https://rain.co.za',
        statistics: {
          averageDownload: 78.3,
          averageUpload: 24.6,
          averageLatency: 27.4,
          reliabilityScore: 82.9,
          totalTests: 2156
        }
      }
    ];
    
    // Insert or update ISPs
    const createdISPs = [];
    for (const ispData of southAfricanISPs) {
      const isp = await ISP.findOneAndUpdate(
        { name: ispData.name },
        ispData,
        { upsert: true, new: true }
      );
      createdISPs.push(isp);
      console.log(`   ✅ ${ispData.displayName} - ${ispData.statistics.averageDownload} Mbps avg`);
    }
    
    console.log(`\n✅ Created/updated ${createdISPs.length} South African ISPs`);
    
    // Create a demo session for Cape Town
    console.log('\n👤 Creating demo user session...');
    
    const demoSession = await UserSession.findOneAndUpdate(
      { sessionToken: 'cape-town-demo-session' },
      {
        sessionToken: 'cape-town-demo-session',
        ipAddress: '196.21.0.123', // Cape Town IP range
        userAgent: 'NETPULSE Demo User - Cape Town',
        location: {
          city: 'Cape Town',
          country: 'ZA',
          region: 'Western Cape',
          lat: -33.9249,
          lng: 18.4241,
          timezone: 'Africa/Johannesburg'
        },
        lastActivity: new Date(),
        totalTests: 0,
        isActive: true
      },
      { upsert: true, new: true }
    );
    
    console.log(`✅ Demo session created: ${demoSession.sessionToken}`);
    
    // Generate realistic speed test data for Cape Town
    console.log('\n📊 Generating speed test data for Cape Town ISPs...');
    
    const speedTests = [];
    const now = new Date();
    
    for (const isp of createdISPs) {
      const numTests = Math.floor(Math.random() * 15) + 10; // 10-25 tests per ISP
      
      for (let i = 0; i < numTests; i++) {
        // Generate realistic variations around ISP averages
        const downloadVar = (Math.random() - 0.5) * 50; // ±25 Mbps
        const uploadVar = (Math.random() - 0.5) * 15;   // ±7.5 Mbps
        const latencyVar = (Math.random() - 0.5) * 12;  // ±6 ms
        
        const downloadSpeed = Math.max(5, isp.statistics.averageDownload + downloadVar);
        const uploadSpeed = Math.max(1, isp.statistics.averageUpload + uploadVar);
        const latency = Math.max(5, isp.statistics.averageLatency + latencyVar);
        
        // Random timestamp within last 30 days
        const testDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        
        const speedTest = {
          downloadSpeed: Math.round(downloadSpeed * 100) / 100,
          uploadSpeed: Math.round(uploadSpeed * 100) / 100,
          latency: Math.round(latency * 100) / 100,
          jitter: Math.round((Math.random() * 4 + 1) * 100) / 100,
          packetLoss: Math.round(Math.random() * 1.5 * 100) / 100,
          testDuration: 15000 + Math.random() * 8000,
          ipAddress: generateCapeTownIP(),
          userAgent: 'NETPULSE Speed Test Client',
          deviceInfo: {
            cpu: 'Demo CPU',
            memory: '8GB',
            os: 'Demo OS'
          },
          networkType: Math.random() > 0.3 ? 'ethernet' : 'wifi',
          location: {
            city: getRandomSACityInWesternCape(),
            country: 'ZA',
            region: 'Western Cape',
            lat: -33.9249 + (Math.random() - 0.5) * 2,
            lng: 18.4241 + (Math.random() - 0.5) * 2,
            timezone: 'Africa/Johannesburg'
          },
          testServerId: 'cape-town-server-1',
          qualityScore: Math.min(100, Math.max(30, 
            (downloadSpeed / 200 * 40) + 
            (uploadSpeed / 50 * 30) + 
            (Math.max(0, 100 - latency) / 100 * 30)
          )),
          ispId: isp._id,
          sessionId: demoSession._id,
          createdAt: testDate
        };
        
        speedTests.push(speedTest);
      }
    }
    
    // Insert speed tests in batches
    console.log(`📤 Inserting ${speedTests.length} speed test records...`);
    const batchSize = 50;
    for (let i = 0; i < speedTests.length; i += batchSize) {
      const batch = speedTests.slice(i, i + batchSize);
      await SpeedTest.insertMany(batch);
      console.log(`   📊 Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(speedTests.length/batchSize)}`);
    }
    
    console.log(`✅ Created ${speedTests.length} speed test records`);
    
    // Update ISP test counts
    console.log('\n🔄 Updating ISP statistics...');
    for (const isp of createdISPs) {
      const testCount = await SpeedTest.countDocuments({ ispId: isp._id });
      await ISP.findByIdAndUpdate(isp._id, {
        'statistics.totalTests': testCount,
        lastUpdated: new Date()
      });
    }
    
    // Final verification
    console.log('\n🔍 Final verification...');
    const finalCounts = {
      isps: await ISP.countDocuments(),
      speedtests: await SpeedTest.countDocuments(),
      usersessions: await UserSession.countDocuments()
    };
    
    console.log('📊 Final document counts:');
    console.log(`   ISPs: ${finalCounts.isps}`);
    console.log(`   Speed Tests: ${finalCounts.speedtests}`);
    console.log(`   User Sessions: ${finalCounts.usersessions}`);
    
    // Test rankings query
    console.log('\n🏆 Testing ISP rankings query...');
    const rankings = await ISP.find({ country: 'ZA', isActive: true })
      .select('name displayName region statistics')
      .sort({ 'statistics.averageDownload': -1 })
      .limit(5);
    
    console.log('Top 5 ISPs by download speed:');
    rankings.forEach((isp, index) => {
      console.log(`   ${index + 1}. ${isp.displayName} - ${isp.statistics.averageDownload} Mbps`);
    });
    
    console.log('\n🎉 Your Atlas cluster is now populated with South African ISP data!');
    console.log('💡 Update your .env file to use this database and restart your server.');
    
  } catch (error) {
    console.error('❌ Failed to populate Atlas cluster:', error);
    
    if (error.message.includes('authentication')) {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('   1. Your MongoDB connection string in .env');
      console.log('   2. Username and password are correct');
      console.log('   3. Database user has read/write permissions');
    }
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from Atlas');
  }
}

// Helper functions for realistic South African data
function generateCapeTownIP() {
  // Common South African ISP IP ranges
  const ranges = [
    '196.21',   // Telkom
    '196.22',   // Various ISPs
    '41.76',    // MTN
    '41.77',    // Vodacom
    '105.20'    // Rain
  ];
  
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  return `${range}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function getRandomSACityInWesternCape() {
  const cities = [
    'Cape Town', 'Stellenbosch', 'Paarl', 'George', 
    'Mossel Bay', 'Worcester', 'Hermanus', 'Knysna'
  ];
  return cities[Math.floor(Math.random() * cities.length)];
}

if (require.main === module) {
  console.log('🇿🇦 NETPULSE Atlas Cluster Population');
  console.log('=====================================\n');
  populateAtlasCluster();
}

module.exports = { populateAtlasCluster };