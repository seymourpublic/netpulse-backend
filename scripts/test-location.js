// test-location.js - Run this to test your location detection
const { getLocationFromIP } = require('./services/locationService');

async function testLocationDetection() {
  console.log('🧪 Testing NETPULSE Location Detection System\n');
  
  const testIPs = [
    '127.0.0.1',           // Localhost (should get external IP)
    '8.8.8.8',             // Google DNS (Mountain View, CA)
    '1.1.1.1',             // Cloudflare DNS (San Francisco, CA)
    '208.67.222.222',      // OpenDNS (San Francisco, CA)
  ];

  for (const ip of testIPs) {
    try {
      console.log(`🌍 Testing IP: ${ip}`);
      const location = await getLocationFromIP(ip);
      
      console.log('✅ Result:', {
        ISP: location.isp,
        City: location.city,
        Region: location.region,
        Country: location.country,
        Coordinates: `${location.lat}, ${location.lng}`,
        Timezone: location.timezone
      });
      console.log('');
      
    } catch (error) {
      console.error(`❌ Failed for ${ip}:`, error.message);
      console.log('');
    }
  }
  
  console.log('🎉 Location detection test completed!');
}

// Run the test
if (require.main === module) {
  testLocationDetection();
}

module.exports = { testLocationDetection };