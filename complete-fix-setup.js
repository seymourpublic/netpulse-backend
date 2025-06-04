// complete-fix-setup.js - Apply all fixes for NETPULSE

const fs = require('fs');
const path = require('path');

async function applyAllFixes() {
  console.log('🔧 NETPULSE Complete Fix Setup');
  console.log('==============================\n');
  
  console.log('This script will help you apply all the fixes for:');
  console.log('✅ Speed test timing issues (no more Infinity Mbps)');
  console.log('✅ Missing ISP rankings');
  console.log('✅ Connection type detection');
  console.log('✅ Proper IP address display');
  console.log('\n📋 Step-by-step instructions:\n');
  
  // Step 1: Speed Test Server
  console.log('1️⃣ SPEED TEST SERVER FIX');
  console.log('=========================');
  console.log('Replace your current server-speedtest.js with the fixed version:');
  console.log('- Stop your current speed test server');
  console.log('- Copy the "Fixed Speed Test Server" code');
  console.log('- Replace your server-speedtest.js file');
  console.log('- Restart: node server-speedtest.js');
  console.log('');
  
  // Step 2: Speed Test Engine
  console.log('2️⃣ SPEED TEST ENGINE FIX');
  console.log('==========================');
  console.log('Replace your customSpeedTestEngine.js:');
  console.log('- Copy the "Improved Custom Speed Test Engine" code');
  console.log('- Replace services/customSpeedTestEngine.js');
  console.log('');
  
  // Step 3: Location Service
  console.log('3️⃣ LOCATION SERVICE ENHANCEMENT');
  console.log('=================================');
  console.log('Create/replace services/locationService.js:');
  console.log('- Copy the "Enhanced Location Service" code');
  console.log('- Save as services/locationService.js');
  console.log('- Install dependencies: npm install geoip-lite axios');
  console.log('');
  
  // Step 4: Speed Test Route
  console.log('4️⃣ SPEED TEST ROUTE UPDATE');
  console.log('=============================');
  console.log('Update your routes/speedTest.js:');
  console.log('- Replace the /network-info endpoint');
  console.log('- Update the comprehensive test route');
  console.log('');
  
  // Step 5: ISP Rankings
  console.log('5️⃣ ISP RANKINGS FIX');
  console.log('=====================');
  console.log('Populate ISP data:');
  console.log('- Copy the "ISP Rankings Debug Fix" script');
  console.log('- Save as scripts/fix-isp-rankings.js');
  console.log('- Run: node scripts/fix-isp-rankings.js');
  console.log('');
  
  // Step 6: Verification
  console.log('6️⃣ VERIFICATION');
  console.log('=================');
  console.log('Test everything:');
  console.log('- Copy the "Speed Test Fix Verification" script');
  console.log('- Save as scripts/verify-fixes.js');
  console.log('- Run: node scripts/verify-fixes.js');
  console.log('');
  
  console.log('🎯 EXPECTED RESULTS AFTER FIXES:');
  console.log('=================================');
  console.log('✅ Realistic speed test results (20-80 Mbps download, 10-40 Mbps upload)');
  console.log('✅ Proper IP address display (not ::ffff:127.0.0.1)');
  console.log('✅ Connection type detected (ethernet/wifi/mobile)');
  console.log('✅ ISP rankings populated with South African ISPs');
  console.log('✅ Location shows Johannesburg, ZA or your actual location');
  console.log('');
  
  console.log('🚨 QUICK TROUBLESHOOTING:');
  console.log('==========================');
  console.log('If issues persist:');
  console.log('1. Make sure MongoDB is running');
  console.log('2. Check that both servers are running (ports 3001 & 5000)');
  console.log('3. Clear browser cache');
  console.log('4. Check browser console for errors');
  console.log('5. Verify API endpoints manually:');
  console.log('   - http://localhost:5000/health');
  console.log('   - http://localhost:5000/api/isp/rankings?country=ZA');
  console.log('   - http://localhost:5000/api/speed-test/network-info');
  console.log('');
  
  await testCurrentState();
}

async function testCurrentState() {
  console.log('🧪 TESTING CURRENT STATE');
  console.log('=========================');
  
  // Test if servers are running
  const servers = [
    { name: 'Speed Test Server', url: 'http://localhost:3001/health' },
    { name: 'Main API Server', url: 'http://localhost:5000/health' },
    { name: 'ISP Rankings', url: 'http://localhost:5000/api/isp/rankings?country=ZA' }
  ];
  
  for (const server of servers) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(server.url, { timeout: 3000 });
      if (response.ok) {
        console.log(`✅ ${server.name} - Running`);
        
        if (server.name === 'ISP Rankings') {
          const data = await response.json();
          console.log(`   Found ${data.rankings?.length || 0} ISP rankings`);
        }
      } else {
        console.log(`⚠️  ${server.name} - Responded with ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${server.name} - Not running (${error.message})`);
    }
  }
  
  console.log('\n📁 FILE STRUCTURE CHECK:');
  console.log('=========================');
  
  const filesToCheck = [
    'server-speedtest.js',
    'services/customSpeedTestEngine.js',
    'services/locationService.js',
    'routes/speedTest.js',
    'models/isp.js'
  ];
  
  filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} missing`);
    }
  });
}

// Create sample package.json dependencies
function showRequiredDependencies() {
  console.log('\n📦 REQUIRED DEPENDENCIES:');
  console.log('==========================');
  console.log('Make sure these are in your package.json:');
  
  const dependencies = {
    "express": "^4.18.0",
    "mongoose": "^7.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "axios": "^1.6.0",
    "geoip-lite": "^1.4.0",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0",
    "express-rate-limit": "^6.7.0",
    "ws": "^8.13.0",
    "node-cron": "^3.0.0",
    "systeminformation": "^5.17.0"
  };
  
  console.log(JSON.stringify(dependencies, null, 2));
  console.log('\nInstall missing dependencies with: npm install [package-name]');
}

// Main execution
if (require.main === module) {
  applyAllFixes()
    .then(() => {
      showRequiredDependencies();
      console.log('\n🎉 Setup guide completed!');
      console.log('Follow the steps above to apply all fixes.');
    })
    .catch(error => {
      console.error('❌ Setup guide failed:', error);
    });
}

module.exports = { applyAllFixes, testCurrentState };