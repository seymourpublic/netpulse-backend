const mongoose = require('mongoose');
require('dotenv').config();

// Define the ISP schema
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

async function debugISPRankings() {
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
    
    // Step 2: List all ISPs
    if (totalISPs > 0) {
      console.log('\n📋 All ISPs in database:');
      const allISPs = await ISP.find({}).select('name displayName country region isActive statistics.averageDownload');
      allISPs.forEach((isp, index) => {
        console.log(`${index + 1}. ${isp.displayName || isp.name} (${isp.country}) - ${isp.statistics?.averageDownload || 0} Mbps - Active: ${isp.isActive}`);
      });
    }
    
    // Step 3: Test the exact query used by the API
    console.log('\n🧪 Testing API Query:');
    console.log('====================');
    
    const apiQuery = {
      country: 'ZA',
      isActive: true
    };
    
    console.log('Query:', JSON.stringify(apiQuery, null, 2));
    
    const rankings = await ISP.find(apiQuery)
      .select('name displayName region statistics')
      .sort({ 'statistics.averageDownload': -1 })
      .limit(10);
    
    console.log(`Query result: ${rankings.length} ISPs found`);
    
    if (rankings.length > 0) {
      console.log('\n🏆 ISP Rankings (API Query Result):');
      rankings.forEach((isp, index) => {
        console.log(`${index + 1}. ${isp.displayName || isp.name}`);
        console.log(`   Region: ${isp.region}`);
        console.log(`   Download: ${isp.statistics?.averageDownload || 0} Mbps`);
        console.log(`   Upload: ${isp.statistics?.averageUpload || 0} Mbps`);
        console.log(`   Reliability: ${isp.statistics?.reliabilityScore || 0}%`);
        console.log('');
      });
      
      console.log('✅ ISP rankings query works! Problem might be in the API endpoint or frontend.');
    } else {
      console.log('❌ No ISPs found with the API query. Creating sample data...');
      await createSampleISPs(ISP);
    }
    
    // Step 4: Test the API endpoint format
    console.log('\n🌐 Testing API Response Format:');
    console.log('===============================');
    
    const apiResponse = {
      rankings: rankings.map((isp, index) => ({
        _id: isp._id,
        name: isp.name,
        displayName: isp.displayName || isp.name,
        region: isp.region,
        rank: index + 1,
        statistics: {
          averageDownload: Math.round((isp.statistics?.averageDownload || 0) * 10) / 10,
          averageUpload: Math.round((isp.statistics?.averageUpload || 0) * 10) / 10,
          averageLatency: Math.round((isp.statistics?.averageLatency || 0) * 10) / 10,
          reliabilityScore: Math.round((isp.statistics?.reliabilityScore || 0) * 10) / 10,
          totalTests: isp.statistics?.totalTests || 0
        }
      })),
      metadata: {
        metric: 'download',
        timeframe: '30d',
        region: 'all',
        country: 'ZA',
        total: rankings.length,
        isDemoData: false,
        updatedAt: new Date()
      }
    };
    
    console.log('API Response Sample:');
    console.log(JSON.stringify(apiResponse, null, 2));
    
    // Step 5: Test your specific API endpoint
    console.log('\n🔌 Testing API Endpoint:');
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
        console.log('Sample ranking:', response.data.rankings[0]);
      } else {
        console.log('❌ API returned empty rankings');
      }
    } catch (apiError) {
      console.error('❌ API endpoint test failed:', apiError.message);
      console.log('💡 Make sure your backend server is running on port 5000');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

async function createSampleISPs(ISP) {
  console.log('\n🌱 Creating sample South African ISPs...');
  
  const sampleISPs = [
    {
      name: 'Vodacom-VB',
      displayName: 'Vodacom SA',
      country: 'ZA',
      region: 'National',
      asn: 36874,
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
      statistics: {
        averageDownload: 168.9,
        averageUpload: 21.3,
        averageLatency: 16.2,
        reliabilityScore: 91.8,
        totalTests: 987
      },
      isActive: true
    }
  ];

  for (const ispData of sampleISPs) {
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
  
  console.log(`✅ Sample ISPs created/updated`);
}

// Test the exact frontend fetch
async function testFrontendFetch() {
  console.log('\n🖥️  Testing Frontend Fetch Logic:');
  console.log('=================================');
  
  try {
    const axios = require('axios');
    
    // Simulate the exact frontend request
    const response = await axios.get(
      'http://localhost:5000/api/isp/rankings?limit=10&country=ZA&metric=download',
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Frontend simulation successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Data type: ${typeof response.data}`);
    console.log(`Rankings: ${response.data.rankings?.length || 0}`);
    
    if (response.data.rankings && response.data.rankings.length > 0) {
      console.log('\n📊 First 3 rankings:');
      response.data.rankings.slice(0, 3).forEach((isp, index) => {
        console.log(`${index + 1}. ${isp.displayName || isp.name} - ${isp.statistics?.averageDownload || 0} Mbps`);
      });
    }
    
    // Check for common issues
    if (!response.data.rankings) {
      console.log('❌ Response missing rankings array');
    }
    
    if (response.data.rankings && response.data.rankings.length === 0) {
      console.log('❌ Rankings array is empty');
    }
    
  } catch (error) {
    console.error('❌ Frontend fetch simulation failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Backend server is not running. Start it with: npm start or node server.js');
    }
  }
}

// Run all tests
async function runAllTests() {
  await debugISPRankings();
  await testFrontendFetch();
  
  console.log('\n📋 Summary & Next Steps:');
  console.log('========================');
  console.log('1. ✅ Run this script to check your database');
  console.log('2. 🚀 Make sure your backend server is running (port 5000)');
  console.log('3. 🔄 Restart your frontend and backend servers');
  console.log('4. 🧪 Test the API endpoint directly: curl http://localhost:5000/api/isp/rankings');
  console.log('5. 🌐 Check if your frontend is connecting to the right API URL');
}

if (require.main === module) {
  runAllTests();
}

module.exports = { debugISPRankings, createSampleISPs, testFrontendFetch };