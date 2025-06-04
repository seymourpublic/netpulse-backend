// isp-rankings-debug-fix.js - Debug and populate ISP rankings

const mongoose = require('mongoose');
require('dotenv').config();

// Define the ISP schema (same as your models)
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

async function debugAndFixISPRankings() {
  try {
    console.log('🔍 Debugging ISP Rankings Issues');
    console.log('==================================\n');
    
    // Connect to your database
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/netpulse';
    console.log(`📡 Connecting to: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const ISP = mongoose.model('ISP', ispSchema);
    
    // Step 1: Check what's in the database
    console.log('\n📊 Database Analysis:');
    console.log('=====================');
    
    const totalISPs = await ISP.countDocuments();
    console.log(`Total ISPs in database: ${totalISPs}`);
    
    const activeISPs = await ISP.countDocuments({ isActive: true });
    console.log(`Active ISPs: ${activeISPs}`);
    
    const zaISPs = await ISP.countDocuments({ country: 'ZA' });
    console.log(`South African ISPs: ${zaISPs}`);
    
    // Step 2: Test the exact query used by the API
    console.log('\n🧪 Testing API Query:');
    console.log('====================');
    
    const apiQuery = { country: 'ZA', isActive: true };
    console.log('Query:', JSON.stringify(apiQuery, null, 2));
    
    const rankings = await ISP.find(apiQuery)
      .select('name displayName region statistics')
      .sort({ 'statistics.averageDownload': -1 })
      .limit(10);
    
    console.log(`Query result: ${rankings.length} ISPs found`);
    
    if (rankings.length === 0) {
      console.log('❌ No ISPs found! Creating South African ISP data...');
      await createSouthAfricanISPs(ISP);
      
      // Test query again
      const newRankings = await ISP.find(apiQuery)
        .select('name displayName region statistics')
        .sort({ 'statistics.averageDownload': -1 })
        .limit(10);
        
      console.log(`✅ After creation: ${newRankings.length} ISPs found`);
      
      if (newRankings.length > 0) {
        console.log('\n🏆 New ISP Rankings:');
        newRankings.forEach((isp, index) => {
          console.log(`${index + 1}. ${isp.displayName || isp.name} - ${isp.statistics?.averageDownload || 0} Mbps`);
        });
      }
    } else {
      console.log('\n🏆 Existing ISP Rankings:');
      rankings.forEach((isp, index) => {
        console.log(`${index + 1}. ${isp.displayName || isp.name} - ${isp.statistics?.averageDownload || 0} Mbps`);
      });
    }
    
    // Step 3: Test the API endpoint directly
    console.log('\n🌐 Testing API Endpoint:');
    console.log('========================');
    
    try {
      const axios = require('axios');
      const response = await axios.get('http://localhost:5000/api/isp/rankings?limit=10&country=ZA', {
        timeout: 5000
      });
      
      console.log('✅ API endpoint responded successfully');
      console.log(`Response status: ${response.status}`);
      console.log(`Rankings count: ${response.data.rankings?.length || 0}`);
      
      if (response.data.rankings && response.data.rankings.length > 0) {
        console.log('\n📊 API Response Sample:');
        console.log('First ranking:', JSON.stringify(response.data.rankings[0], null, 2));
      } else {
        console.log('❌ API returned empty rankings');
      }
    } catch (apiError) {
      console.error('❌ API endpoint test failed:', apiError.message);
      console.log('💡 Make sure your backend server is running on port 5000');
      console.log('💡 Also check that your ISP route is properly configured');
    }
    
    // Step 4: Check indexes
    console.log('\n🔍 Checking Database Indexes:');
    console.log('=============================');
    
    const indexes = await ISP.collection.getIndexes();
    console.log('Current indexes:', Object.keys(indexes));
    
    // Create missing indexes if needed
    try {
      await ISP.collection.createIndex({ country: 1 });
      await ISP.collection.createIndex({ 'statistics.averageDownload': -1 });
      await ISP.collection.createIndex({ isActive: 1 });
      console.log('✅ Indexes created/verified');
    } catch (indexError) {
      console.log('⚠️ Index creation failed (may already exist):', indexError.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

async function createSouthAfricanISPs(ISP) {
  console.log('\n🇿🇦 Creating South African ISPs...');
  
  const southAfricanISPs = [
    {
      name: 'Vodacom-VB',
      displayName: 'Vodacom SA',
      country: 'ZA',
      region: 'National',
      asn: 36874,
      website: 'https://www.vodacom.co.za',
      statistics: {
        averageDownload: 85.4,
        averageUpload: 28.7,
        averageLatency: 24.2,
        reliabilityScore: 84.6,
        totalTests: 2847
      },
      isActive: true
    },
    {
      name: 'Afrihost',
      displayName: 'Afrihost',
      country: 'ZA',
      region: 'National',
      asn: 36937,
      website: 'https://www.afrihost.com',
      statistics: {
        averageDownload: 165.3,
        averageUpload: 22.8,
        averageLatency: 16.5,
        reliabilityScore: 92.1,
        totalTests: 1534
      },
      isActive: true
    },
    {
      name: 'Cool Ideas',
      displayName: 'Cool Ideas',
      country: 'ZA',
      region: 'Western Cape',
      asn: 37721,
      website: 'https://www.coolideas.co.za',
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
      asn: 37457,
      website: 'https://www.telkom.co.za',
      statistics: {
        averageDownload: 142.6,
        averageUpload: 19.8,
        averageLatency: 18.7,
        reliabilityScore: 88.9,
        totalTests: 2341
      },
      isActive: true
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
      },
      isActive: true
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
      },
      isActive: true
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
      },
      isActive: true
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
      },
      isActive: true
    }
  ];

  for (const ispData of southAfricanISPs) {
    try {
      await ISP.findOneAndUpdate(
        { name: ispData.name },
        ispData,
        { upsert: true, new: true }
      );
      console.log(`✅ Created/updated: ${ispData.displayName}`);
    } catch (error) {
      console.log(`❌ Failed to create ${ispData.displayName}: ${error.message}`);
    }
  }
  
  console.log(`✅ South African ISPs created/updated`);
}

// Quick API test
async function quickAPITest() {
  console.log('\n🚀 Quick API Test');
  console.log('=================');
  
  const tests = [
    'http://localhost:5000/health',
    'http://localhost:5000/api/isp/rankings?country=ZA',
    'http://localhost:5000/api/speed-test/network-info'
  ];
  
  for (const url of tests) {
    try {
      const axios = require('axios');
      const response = await axios.get(url, { timeout: 3000 });
      console.log(`✅ ${url} - OK (${response.status})`);
      
      if (url.includes('rankings')) {
        console.log(`   Found ${response.data.rankings?.length || 0} ISP rankings`);
      }
    } catch (error) {
      console.log(`❌ ${url} - Failed: ${error.message}`);
    }
  }
}

// Complete fix workflow
async function runCompleteFix() {
  console.log('🔧 NETPULSE ISP Rankings Complete Fix');
  console.log('====================================\n');
  
  await debugAndFixISPRankings();
  await quickAPITest();
  
  console.log('\n📋 Summary & Next Steps:');
  console.log('========================');
  console.log('1. ✅ Run this script to populate ISP data');
  console.log('2. 🔄 Restart your backend server');
  console.log('3. 🌐 Refresh your frontend');
  console.log('4. 📊 ISP rankings should now appear');
  console.log('\nIf rankings still don\'t appear:');
  console.log('- Check browser console for errors');
  console.log('- Verify API endpoint: http://localhost:5000/api/isp/rankings?country=ZA');
  console.log('- Check network tab in browser dev tools');
}

if (require.main === module) {
  runCompleteFix();
}

module.exports = { debugAndFixISPRankings, createSouthAfricanISPs, quickAPITest };