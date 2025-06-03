// debug-speed-test.js - Run this to debug your speed calculations

const CustomSpeedTestEngine = require('./services/customSpeedTestEngine');

async function debugSpeedTest() {
  console.log('🔧 DEBUGGING SPEED TEST CALCULATIONS\n');
  
  const engine = new CustomSpeedTestEngine();
  
  try {
    console.log('Testing with debug logging enabled...');
    
    // Test with short duration for debugging
    const results = await engine.runComprehensiveTest('127.0.0.1', {
      testDuration: 3, // Short test for debugging
      latencyTests: 3
    });
    
    console.log('\n📊 DETAILED RESULTS ANALYSIS:');
    console.log('=====================================');
    
    // Download Analysis
    console.log('\n📥 DOWNLOAD TEST:');
    console.log(`Final Speed: ${results.results.download.speed} Mbps`);
    console.log(`Consistency: ${results.results.download.consistency}%`);
    console.log(`Sample Count: ${results.results.download.samples?.length || 0}`);
    
    if (results.results.download.samples?.length > 0) {
      const speeds = results.results.download.samples.map(s => s.speed);
      console.log(`Speed Range: ${Math.min(...speeds).toFixed(1)} - ${Math.max(...speeds).toFixed(1)} Mbps`);
      console.log(`Individual Samples:`, speeds.slice(0, 5).map(s => `${s.toFixed(1)} Mbps`).join(', '));
    }
    
    // Upload Analysis
    console.log('\n📤 UPLOAD TEST:');
    console.log(`Final Speed: ${results.results.upload.speed} Mbps`);
    console.log(`Consistency: ${results.results.upload.consistency}%`);
    console.log(`Sample Count: ${results.results.upload.samples?.length || 0}`);
    
    if (results.results.upload.samples?.length > 0) {
      const speeds = results.results.upload.samples.map(s => s.speed);
      console.log(`Speed Range: ${Math.min(...speeds).toFixed(1)} - ${Math.max(...speeds).toFixed(1)} Mbps`);
      console.log(`Individual Samples:`, speeds.slice(0, 5).map(s => `${s.toFixed(1)} Mbps`).join(', '));
    }
    
    // Latency Analysis
    console.log('\n📡 LATENCY TEST:');
    console.log(`Average: ${results.results.latency.avg} ms`);
    console.log(`Range: ${results.results.latency.min} - ${results.results.latency.max} ms`);
    console.log(`Jitter: ${results.results.latency.jitter} ms`);
    
    // Quality Analysis
    console.log('\n🏆 QUALITY ANALYSIS:');
    console.log(`Overall Score: ${results.results.quality.score}/100`);
    console.log(`Grade: ${results.results.quality.grade}`);
    
    if (results.results.quality.breakdown) {
      console.log('Score Breakdown:');
      Object.entries(results.results.quality.breakdown).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}/100`);
      });
    }
    
    // Server Info
    console.log('\n🌐 SERVER INFO:');
    console.log(`Server: ${results.server?.id} (${results.server?.location})`);
    console.log(`Available: ${results.server?.available}`);
    console.log(`Test Duration: ${Math.round(results.metadata.duration)}ms`);
    
    // Validation Checks
    console.log('\n✅ VALIDATION CHECKS:');
    
    const downloadSpeed = results.results.download.speed;
    const uploadSpeed = results.results.upload.speed;
    
    if (downloadSpeed > 1000) {
      console.log('❌ WARNING: Download speed > 1000 Mbps (unrealistic for most connections)');
    } else if (downloadSpeed > 500) {
      console.log('⚠️  NOTICE: Download speed > 500 Mbps (very fast connection)');
    } else if (downloadSpeed < 1) {
      console.log('❌ WARNING: Download speed < 1 Mbps (very slow or error)');
    } else {
      console.log('✅ Download speed within normal range');
    }
    
    if (uploadSpeed > 500) {
      console.log('❌ WARNING: Upload speed > 500 Mbps (unrealistic for most connections)');
    } else if (uploadSpeed > 100) {
      console.log('⚠️  NOTICE: Upload speed > 100 Mbps (very fast connection)');
    } else if (uploadSpeed < 1) {
      console.log('❌ WARNING: Upload speed < 1 Mbps (very slow or error)');
    } else {
      console.log('✅ Upload speed within normal range');
    }
    
    if (results.results.latency.avg > 100) {
      console.log('⚠️  NOTICE: High latency (> 100ms)');
    } else if (results.results.latency.avg < 1) {
      console.log('❌ WARNING: Extremely low latency (< 1ms, possible error)');
    } else {
      console.log('✅ Latency within normal range');
    }
    
    console.log('\n🎉 Debug analysis completed!');
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Manual speed calculation test
function testSpeedCalculation() {
  console.log('\n🧮 MANUAL SPEED CALCULATION TEST:');
  console.log('=====================================');
  
  // Test parameters
  const testSizeMB = 1; // 1 MB
  const testSizeBytes = testSizeMB * 1024 * 1024; // 1,048,576 bytes
  const testDurationSeconds = 0.5; // 500ms
  
  console.log(`Test size: ${testSizeMB} MB (${testSizeBytes.toLocaleString()} bytes)`);
  console.log(`Test duration: ${testDurationSeconds} seconds`);
  
  // Speed calculation
  const speedBitsPerSecond = (testSizeBytes * 8) / testDurationSeconds;
  const speedMbps = speedBitsPerSecond / 1000000;
  
  console.log(`\nCalculation steps:`);
  console.log(`1. Total bits: ${testSizeBytes} bytes × 8 = ${(testSizeBytes * 8).toLocaleString()} bits`);
  console.log(`2. Bits per second: ${(testSizeBytes * 8).toLocaleString()} ÷ ${testDurationSeconds} = ${speedBitsPerSecond.toLocaleString()}`);
  console.log(`3. Mbps: ${speedBitsPerSecond.toLocaleString()} ÷ 1,000,000 = ${speedMbps.toFixed(2)} Mbps`);
  
  console.log(`\nExpected result: ~${speedMbps.toFixed(1)} Mbps`);
  
  // Show what different durations would give
  console.log(`\nSpeed for different durations:`);
  [0.1, 0.2, 0.5, 1.0, 2.0].forEach(duration => {
    const speed = ((testSizeBytes * 8) / duration) / 1000000;
    console.log(`  ${duration}s duration = ${speed.toFixed(1)} Mbps`);
  });
}

// Run the debug functions
if (require.main === module) {
  console.log('🚀 Starting Speed Test Debug Analysis\n');
  
  testSpeedCalculation();
  
  setTimeout(async () => {
    await debugSpeedTest();
  }, 1000);
}

module.exports = { debugSpeedTest, testSpeedCalculation };