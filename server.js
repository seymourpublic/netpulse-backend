// server.js - Main Node.js backend for Speed Test application
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const { exec } = require('child_process');
const geoip = require('geoip-lite');
const os = require('os');
const cron = require('node-cron');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

app.use('/web', require('./routes/webRoutes'));

app.get('/', (req, res) => {
  res.status(200).json({ message: "Truck Support API is running 🚛🔥" });
});

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'speedtest',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Initialize database tables
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS speed_tests (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        download_speed FLOAT,
        upload_speed FLOAT,
        latency FLOAT,
        jitter FLOAT,
        packet_loss FLOAT,
        isp TEXT,
        server_location TEXT,
        ip_address TEXT,
        device_info TEXT,
        network_type TEXT,
        country TEXT,
        region TEXT,
        city TEXT
      );
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Initialize the database on startup
initDatabase();

// Helper function to run speedtest-cli
async function runSpeedTest() {
  try {
    // Using speedtest-cli (must be installed)
    const { stdout } = await execPromise('speedtest-cli --json');
    const result = JSON.parse(stdout);
    
    return {
      download: result.download / 1000000, // Convert to Mbps
      upload: result.upload / 1000000,     // Convert to Mbps
      latency: result.ping,
      server: result.server,
      client: result.client
    };
  } catch (error) {
    console.error('Error running speed test:', error);
    throw new Error('Failed to run speed test');
  }
}

// Alternative implementation using LibreSpeed (if speedtest-cli is not available)
async function runLibreSpeedTest() {
  // This would be an implementation using librespeed-cli or a custom implementation
  // For demonstration, return mock data
  return {
    download: Math.random() * 500 + 50,
    upload: Math.random() * 200 + 20,
    latency: Math.random() * 50 + 5,
    jitter: Math.random() * 10 + 1,
    packetLoss: Math.random() * 2,
    server: {
      name: "Server 1",
      location: "New York, NY",
      country: "United States"
    }
  };
}

// Run speed test via API
// Schedule regular background tests (every 3 hours)
cron.schedule('0 */3 * * *', async () => {
  try {
    console.log('Running scheduled speed test...');
    const speedTestResult = await runSpeedTest();
    
    // Prepare data for storage
    const testData = {
      download_speed: speedTestResult.download,
      upload_speed: speedTestResult.upload,
      latency: speedTestResult.latency,
      jitter: speedTestResult.jitter || 0,
      packet_loss: speedTestResult.packetLoss || 0,
      isp: speedTestResult.client?.isp || 'Unknown',
      server_location: `${speedTestResult.server?.name}, ${speedTestResult.server?.country}`,
      ip_address: '127.0.0.1', // Local test
      device_info: 'Scheduled Test - ' + os.type() + ' ' + os.release(),
      network_type: 'Scheduled',
      country: speedTestResult.client?.country || 'Unknown',
      region: 'Server',
      city: 'Server'
    };
    
    // Store the result in the database
    await pool.query(
      `INSERT INTO speed_tests 
      (download_speed, upload_speed, latency, jitter, packet_loss, isp, server_location, ip_address, device_info, network_type, country, region, city)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        testData.download_speed, testData.upload_speed, testData.latency, testData.jitter,
        testData.packet_loss, testData.isp, testData.server_location, testData.ip_address,
        testData.device_info, testData.network_type, testData.country, testData.region, testData.city
      ]
    );
    
    console.log('Scheduled test completed and saved');
  } catch (error) {
    console.error('Error during scheduled speed test:', error);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Speed Test backend server running on port ${port}`);
});

module.exports = app; // For testing