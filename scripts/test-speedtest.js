const CustomSpeedTestEngine = require('./../services/customSpeedTestEngine');

async function testSpeedTestSystem() {
  console.log('🧪 Testing NETPULSE Custom Speed Test System\\n');
  
  const engine = new CustomSpeedTestEngine();
  
  try {
    console.log('Running comprehensive speed test...');
    const results = await engine.runComprehensiveTest('127.0.0.1', {
      testDuration: 5, // Shorter for testing
      latencyTests: 5
    });
    
    console.log('\\n✅ Speed Test Results:');
    console.log(`📥 Download: ${results.results.download.speed.toFixed(1)} Mbps (Consistency: ${results.results.download.consistency.toFixed(1)}%)`);
    console.log(`📤 Upload: ${results.results.upload.speed.toFixed(1)} Mbps (Consistency: ${results.results.upload.consistency.toFixed(1)}%)`);
    console.log(`⚡ Latency: ${results.results.latency.avg.toFixed(1)}ms (Jitter: ${results.results.latency.jitter.toFixed(1)}ms)`);
    console.log(`📦 Packet Loss: ${results.results.packetLoss.toFixed(1)}%`);
    console.log(`🏆 Quality Score: ${results.results.quality.score.toFixed(1)}/100 (Grade: ${results.results.quality.grade})`);
    console.log(`🔒 Reliability: ${results.metadata.reliability.toFixed(1)}%`);
    console.log(`⏱️ Total Duration: ${Math.round(results.metadata.duration)}ms`);
    
    console.log('\\n🎉 Speed test system working correctly!');
    
  } catch (error) {
    console.error('❌ Speed test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testSpeedTestSystem();
}
