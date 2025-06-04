// speed-test-fix-verification.js - Run this to test the fixes

const CustomSpeedTestEngine = require('./services/customSpeedTestEngine');

async function testFixedSpeedSystem() {
  console.log('🧪 Testing FIXED NETPULSE Speed Test System');
  console.log('===========================================\n');
  
  const engine = new CustomSpeedTestEngine();
  
  try {
    console.log('🚀 Running speed test with improved timing...');
    const results = await engine.runComprehensiveTest('127.0.0.1', {
      testDuration: 3, // Short test for verification
      latencyTests: 3
    });
    
    console.log('\n✅ FIXED Speed Test Results:');
    console.log('============================');
    
    // Download Analysis
    console.log(`📥 Download: ${results.results.download.speed.toFixed(1)} Mbps`);
    console.log(`   Consistency: ${results.results.download.consistency.toFixed(1)}%`);
    console.log(`   Samples: ${results.results.download.samples?.length || 0}`);
    
    // Upload Analysis  
    console.log(`📤 Upload: ${results.results.upload.speed.toFixed(1)} Mbps`);
    console.log(`   Consistency: ${results.results.upload.consistency.toFixed(1)}%`);
    console.log(`   Samples: ${results.results.upload.samples?.length || 0}`);
    
    // Latency Analysis
    console.log(`📡 Latency: ${results.results.latency.avg.toFixed(1)}ms`);
    console.log(`   Jitter: ${results.results.latency.jitter.toFixed(1)}ms`);
    console.log(`   Range: ${results.results.latency.min.toFixed(1)}-${results.results.latency.max.toFixed(1)}ms`);
    
    // Quality Analysis
    console.log(`🏆 Quality: ${results.results.quality.score.toFixed(1)}/100 (${results.results.quality.grade})`);
    console.log(`🔒 Reliability: ${results.metadata.reliability.toFixed(1)}%`);
    console.log(`⏱️  Duration: ${Math.round(results.metadata.duration)}ms`);
    
    // Validation
    console.log('\n🔍 VALIDATION RESULTS:');
    console.log('======================');
    
    const downloadSpeed = results.results.download.speed;
    const uploadSpeed = results.results.upload.speed;
    
    // Check for realistic speeds
    if (downloadSpeed > 0 && downloadSpeed < 200) {
      console.log('✅ Download speed is realistic');
    } else if (downloadSpeed === Infinity || downloadSpeed > 1000) {
      console.log('❌ Download speed still showing unrealistic values');
    } else {
      console.log('⚠️  Download speed seems unusual:', downloadSpeed);
    }
    
    if (uploadSpeed > 0 && uploadSpeed < 100) {
      console.log('✅ Upload speed is realistic');
    } else if (uploadSpeed === Infinity || uploadSpeed > 500) {
      console.log('❌ Upload speed still showing unrealistic values');
    } else {
      console.log('⚠️  Upload speed seems unusual:', uploadSpeed);
    }
    
    if (results.results.latency.avg > 0 && results.results.latency.avg < 200) {
      console.log('✅ Latency is realistic');
    } else {
      console.log('⚠️  Latency seems unusual:', results.results.latency.avg);
    }
    
    // Check for samples
    if (results.results.download.samples?.length > 0) {
      console.log('✅ Download samples collected successfully');
      const speeds = results.results.download.samples.map(s => s.speed);
      console.log(`   Speed range: ${Math.min(...speeds).toFixed(1)} - ${Math.max(...speeds).toFixed(1)} Mbps`);
    } else {
      console.log('❌ No download samples collected');
    }
    
    if (results.results.upload.samples?.length > 0) {
      console.log('✅ Upload samples collected successfully');
      const speeds = results.results.upload.samples.map(s => s.speed);
      console.log(`   Speed range: ${Math.min(...speeds).toFixed(1)} - ${Math.max(...speeds).toFixed(1)} Mbps`);
    } else {
      console.log('❌ No upload samples collected');
    }
    
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('===================');
    
    if (downloadSpeed > 100) {
      console.log('💡 Download speed > 100 Mbps - Consider reducing test chunk sizes');
    }
    
    if (uploadSpeed > 50) {
      console.log('💡 Upload speed > 50 Mbps - Consider reducing upload test duration');
    }
    
    if (results.results.latency.avg < 5) {
      console.log('💡 Very low latency - Normal for localhost testing');
    }
    
    console.log('\n🎉 Speed test fix verification completed!');
    
    return results;
    
  } catch (error) {
    console.error('❌ Speed test verification failed:', error);
    console.error('Stack trace:', error.stack);
    
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('=========================');
    console.log('1. Make sure your speed test server is running on port 3001');
    console.log('2. Replace your customSpeedTestEngine.js with the improved version');
    console.log('3. Replace your server-speedtest.js with the fixed version');
    console.log('4. Restart both servers and try again');
    
    return null;
  }
}

// Test server connectivity
async function testServerConnectivity() {
  console.log('\n🔌 Testing Server Connectivity');
  console.log('==============================');
  
  const servers = [
    'http://localhost:3001/health',
    'http://localhost:3001/api/ping',
    'http://localhost:3001/api/info'
  ];
  
  for (const url of servers) {
    try {
      const response = await fetch(url, { timeout: 3000 });
      if (response.ok) {
        console.log(`✅ ${url} - Connected`);
      } else {
        console.log(`⚠️  ${url} - Server responded with ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${url} - Failed: ${error.message}`);
    }
  }
}

// Manual speed calculation test
function manualSpeedCalculationTest() {
  console.log('\n🧮 Manual Speed Calculation Test');
  console.log('================================');
  
  const testCases = [
    { bytes: 524288, timeMs: 100, expectedMbps: 41.9 },   // 512KB in 100ms
    { bytes: 1048576, timeMs: 200, expectedMbps: 41.9 },  // 1MB in 200ms
    { bytes: 524288, timeMs: 50, expectedMbps: 83.9 },    // 512KB in 50ms
  ];
  
  testCases.forEach((test, index) => {
    const timeSeconds = test.timeMs / 1000;
    const speedMbps = (test.bytes * 8) / (timeSeconds * 1000000);
    
    console.log(`Test ${index + 1}:`);
    console.log(`  ${test.bytes} bytes in ${test.timeMs}ms`);
    console.log(`  Calculated: ${speedMbps.toFixed(1)} Mbps`);
    console.log(`  Expected: ~${test.expectedMbps} Mbps`);
    console.log(`  Status: ${Math.abs(speedMbps - test.expectedMbps) < 5 ? '✅' : '❌'}`);
    console.log('');
  });
}

// Run all tests
async function runAllTests() {
  await testServerConnectivity();
  manualSpeedCalculationTest();
  await testFixedSpeedSystem();
  
  console.log('\n📋 SUMMARY:');
  console.log('===========');
  console.log('If you see realistic speeds (5-80 Mbps download, 3-40 Mbps upload),');
  console.log('the fixes are working correctly!');
  console.log('');
  console.log('If you still see "Infinity Mbps" or unrealistic speeds:');
  console.log('1. Stop your current speed test server');
  console.log('2. Replace it with the fixed version');
  console.log('3. Restart and test again');
}

// Run the verification
if (require.main === module) {
  runAllTests();
}

module.exports = { testFixedSpeedSystem, testServerConnectivity, manualSpeedCalculationTest };