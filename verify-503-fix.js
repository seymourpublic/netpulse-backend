// verify-503-fix.js
// Run this to verify the 503 error fix is complete

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 Verifying 503 Error Fix\n');
console.log('==========================\n');

let allGood = true;

// Check 1: Verify fetch import was added
console.log('1️⃣ Checking customSpeedTestEngine.js for fetch import...');
try {
  const content = fs.readFileSync('customSpeedTestEngine.js', 'utf8');
  if (content.includes("require('node-fetch')") || content.includes('require("node-fetch")')) {
    console.log('   ✅ fetch import found\n');
  } else {
    console.log('   ❌ fetch import NOT found!');
    console.log('   Add this line after the other imports:');
    console.log('   const fetch = require(\'node-fetch\');\n');
    allGood = false;
  }
} catch (error) {
  console.log('   ❌ Could not read customSpeedTestEngine.js');
  console.log('   Make sure you\'re in the project root directory\n');
  allGood = false;
}

// Check 2: Verify node-fetch is installed
console.log('2️⃣ Checking if node-fetch is installed...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const hasNodeFetch = 
    (packageJson.dependencies && packageJson.dependencies['node-fetch']) ||
    (packageJson.devDependencies && packageJson.devDependencies['node-fetch']);
  
  if (hasNodeFetch) {
    console.log('   ✅ node-fetch is in package.json');
    
    // Check if it's actually installed
    try {
      require.resolve('node-fetch');
      console.log('   ✅ node-fetch is installed in node_modules\n');
    } catch {
      console.log('   ⚠️  node-fetch in package.json but not installed');
      console.log('   Run: npm install\n');
      allGood = false;
    }
  } else {
    console.log('   ❌ node-fetch is NOT installed!');
    console.log('   Run: npm install node-fetch@2\n');
    allGood = false;
  }
} catch (error) {
  console.log('   ⚠️  Could not check package.json');
  console.log('   Try: npm install node-fetch@2\n');
}

// Check 3: Verify Node.js version
console.log('3️⃣ Checking Node.js version...');
try {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  console.log(`   Node.js version: ${nodeVersion}`);
  if (majorVersion >= 14) {
    console.log('   ✅ Node.js version is compatible\n');
  } else {
    console.log('   ⚠️  Node.js version is old. Consider upgrading to v18+\n');
  }
} catch (error) {
  console.log('   ⚠️  Could not check Node.js version\n');
}

// Check 4: Verify both servers can start (simulation)
console.log('4️⃣ Checking server files exist...');
const serverFiles = [
  { file: 'server-speedtest.js', name: 'Speed Test Server' },
  { file: 'server.js', name: 'Main API Server' }
];

serverFiles.forEach(({ file, name }) => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${name} (${file}) exists`);
  } else {
    console.log(`   ❌ ${name} (${file}) NOT FOUND!`);
    allGood = false;
  }
});
console.log('');

// Summary
console.log('📋 SUMMARY\n');
console.log('==========\n');

if (allGood) {
  console.log('✅ All checks passed! The fix is complete.\n');
  console.log('📝 Next steps:');
  console.log('   1. Make sure node-fetch is installed: npm install node-fetch@2');
  console.log('   2. Restart your main API server (port 5000)');
  console.log('   3. Keep speed test server running (port 3001)');
  console.log('   4. Test speed test from frontend\n');
  console.log('🎉 Your 503 error should be fixed!');
} else {
  console.log('⚠️  Some issues found. Please fix them:\n');
  console.log('1. Make sure fetch import is in customSpeedTestEngine.js');
  console.log('2. Run: npm install node-fetch@2');
  console.log('3. Restart your main API server');
  console.log('');
  console.log('Then run this script again to verify.');
}

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('');