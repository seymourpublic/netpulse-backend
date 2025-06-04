// quick-api-test.js - Test your API endpoints quickly

const axios = require('axios');

async function quickAPITest() {
  console.log('⚡ Quick API Test for NETPULSE');
  console.log('==============================\n');
  
  const API_BASE = 'http://localhost:5000';
  
  // Test 1: Health Check
  console.log('1️⃣ Testing Health Endpoint...');
  try {
    const health = await axios.get(`${API_BASE}/health`, { timeout: 3000 });
    console.log(`✅ Health: ${health.status} - ${health.data.status}`);
    console.log(`   Database: ${health.data.database}`);
  } catch (error) {
    console.log(`❌ CORS test failed: ${error.message}`);
  }
  
  console.log('\n📋 Summary:');
  console.log('===========');
  console.log('If all tests pass ✅, your backend is working correctly.');
  console.log('If ISP Rankings fails ❌, run: node isp-rankings-debug-fix.js');
  console.log('If Health fails ❌, start your backend: npm start or node server.js');
  console.log('\n🔧 Quick Fixes:');
  console.log('===============');
  console.log('1. Speed Calculation: Replace your customSpeedTestEngine.js');
  console.log('2. ISP Rankings: Run the debug script to populate data');
  console.log('3. Frontend Issues: Check browser console for errors');
}

// Test specific endpoint with detailed output
async function testISPEndpointDetailed() {
  console.log('\n🔍 Detailed ISP Endpoint Test');
  console.log('=============================');
  
  try {
    const response = await axios.get('http://localhost:5000/api/isp/rankings?country=ZA&limit=5', {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Response Details:');
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Data Type: ${typeof response.data}`);
    
    if (response.data) {
      console.log('\n📋 Response Structure:');
      console.log(`- rankings: ${Array.isArray(response.data.rankings) ? 'Array' : typeof response.data.rankings} (${response.data.rankings?.length || 0} items)`);
      console.log(`- metadata: ${typeof response.data.metadata}`);
      
      if (response.data.rankings && response.data.rankings.length > 0) {
        const firstISP = response.data.rankings[0];
        console.log('\n🏆 First ISP Structure:');
        console.log(`- _id: ${typeof firstISP._id}`);
        console.log(`- name: ${typeof firstISP.name} ("${firstISP.name}")`);
        console.log(`- displayName: ${typeof firstISP.displayName} ("${firstISP.displayName}")`);
        console.log(`- region: ${typeof firstISP.region} ("${firstISP.region}")`);
        console.log(`- statistics: ${typeof firstISP.statistics}`);
        
        if (firstISP.statistics) {
          console.log(`  - averageDownload: ${typeof firstISP.statistics.averageDownload} (${firstISP.statistics.averageDownload})`);
          console.log(`  - reliabilityScore: ${typeof firstISP.statistics.reliabilityScore} (${firstISP.statistics.reliabilityScore})`);
        }
        
        console.log('\n✅ ISP data structure looks correct for frontend consumption');
      } else {
        console.log('\n❌ No rankings data found');
      }
    }
    
  } catch (error) {
    console.error('❌ Detailed test failed:', error.message);
    
    if (error.response) {
      console.log(`Response Status: ${error.response.status}`);
      console.log(`Response Data:`, error.response.data);
    }
  }
}

// Test speed calculation
function testSpeedCalculation() {
  console.log('\n🧮 Testing Speed Calculation Logic');
  console.log('==================================');
  
  // Test different scenarios
  const testCases = [
    { bytes: 1048576, timeMs: 1000, expected: '8.39 Mbps' }, // 1MB in 1 second
    { bytes: 1048576, timeMs: 500, expected: '16.78 Mbps' }, // 1MB in 0.5 seconds  
    { bytes: 524288, timeMs: 300, expected: '13.98 Mbps' },  // 512KB in 0.3 seconds
    { bytes: 2097152, timeMs: 200, expected: '83.89 Mbps' }  // 2MB in 0.2 seconds
  ];
  
  console.log('Formula: (bytes × 8) ÷ (timeSeconds × 1,000,000) = Mbps\n');
  
  testCases.forEach((test, index) => {
    const timeSeconds = test.timeMs / 1000;
    const speedMbps = (test.bytes * 8) / (timeSeconds * 1000000);
    
    console.log(`Test ${index + 1}:`);
    console.log(`  Input: ${test.bytes} bytes in ${test.timeMs}ms`);
    console.log(`  Calculation: (${test.bytes} × 8) ÷ (${timeSeconds} × 1,000,000)`);
    console.log(`  Result: ${speedMbps.toFixed(2)} Mbps`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Status: ${Math.abs(speedMbps - parseFloat(test.expected)) < 1 ? '✅' : '❌'}`);
    console.log('');
  });
  
  console.log('💡 For realistic localhost speeds, ensure:');
  console.log('   - Chunk sizes are small (0.5-1 MB)');
  console.log('   - Test duration is short (3-5 seconds)');
  console.log('   - Results are capped at reasonable limits (< 200 Mbps)');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--detailed')) {
    testISPEndpointDetailed();
  } else if (args.includes('--speed')) {
    testSpeedCalculation();
  } else {
    quickAPITest();
  }
}

module.exports = { quickAPITest, testISPEndpointDetailed, testSpeedCalculation };(`❌ Health check failed: ${error.message}`);
    console.log('💡 Make sure your backend server is running!');
    return;
  }
  
  // Test 2: ISP Rankings
  console.log('\n2️⃣ Testing ISP Rankings...');
  try {
    const rankings = await axios.get(`${API_BASE}/api/isp/rankings`, { timeout: 5000 });
    console.log(`✅ ISP Rankings: ${rankings.status}`);
    console.log(`   Found ${rankings.data.rankings?.length || 0} ISPs`);
    
    if (rankings.data.rankings && rankings.data.rankings.length > 0) {
      console.log('   Top ISP:', rankings.data.rankings[0].displayName || rankings.data.rankings[0].name);
    } else {
      console.log('❌ No ISP rankings returned');
    }
  } catch (error) {
    console.log(`❌ ISP Rankings failed: ${error.message}`);
  }
  
  // Test 3: Network Info
  console.log('\n3️⃣ Testing Network Info...');
  try {
    const network = await axios.get(`${API_BASE}/api/speed-test/network-info`, { timeout: 5000 });
    console.log(`✅ Network Info: ${network.status}`);
    console.log(`   ISP: ${network.data.isp}`);
    console.log(`   Location: ${network.data.location?.city}, ${network.data.location?.country}`);
  } catch (error) {
    console.log(`❌ Network Info failed: ${error.message}`);
  }
  
  // Test 4: Test CORS
  console.log('\n4️⃣ Testing CORS...');
  try {
    const corsTest = await axios.get(`${API_BASE}/api/isp/rankings`, {
      headers: {
        'Origin': 'http://localhost:3000',
        'Accept': 'application/json'
      },
      timeout: 3000
    });
    console.log(`✅ CORS: ${corsTest.status} - Frontend should work`);
  } catch (error) {
    console.log(`❌ CORS test failed: ${error.message}`);
    if (error.response) {
      console.log(`   Response Status: ${error.response.status}`);
      console.log(`   Response Data:`, error.response.data);
    }       
    }
    console.log('\n🎉 Quick API Test Completed!')
        console.log('💡 If any tests failed, check your backend logs for errors.')
        console.log('   and ensure your server is running correctly.');
    }
if (require.main === module) {
    quickAPITest()
        .then(() => console.log('✅ Quick API Test completed successfully!'))
        .catch(error => console.error('❌ Quick API Test failed:', error));
    }
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
     console.log('💡 You can now run speed tests without the CastError.')
     } catch (error) {
            console.error('❌ MongoDB fix failed:', error);
     } finally {
       await mongoose.disconnect();
       console.log('👋 Disconnected from MongoDB');
     }
// }    
//     console.log('👋 Disconnected from MongoDB')
//                  
// // async function createSampleSpeedTest(db) {
//  
//  const sampleSpeedTest = {   
//    downloadSpeed: 150.5,
//   uploadSpeed: 25.3,
//   latency: 18.7,
//  rawResults: {
//    ping: 20,
//   jitter: 5,
// packetLoss: 0.1
// // },
// //   timestamp: new Date(),
// //   location: {
// //     city: 'Test City',
// //     country: 'Test Country'
//  //   },;