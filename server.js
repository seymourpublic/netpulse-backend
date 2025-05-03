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
app.post('/api/run-test', async (req, res) => {
  try {
    const { deviceInfo, networkType } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Get geo information from IP
    const geo = geoip.lookup(ipAddress.replace('::ffff:', ''));
    
    // Run the speed test
    const speedTestResult = await runSpeedTest();
    
    // Prepare the data for storage
    const testData = {
      download_speed: speedTestResult.download,
      upload_speed: speedTestResult.upload,
      latency: speedTestResult.latency,
      jitter: speedTestResult.jitter || 0,
      packet_loss: speedTestResult.packetLoss || 0,
      isp: speedTestResult.client?.isp || 'Unknown',
      server_location: `${speedTestResult.server?.name}, ${speedTestResult.server?.country}`,
      ip_address: ipAddress,
      device_info: deviceInfo || os.type() + ' ' + os.release(),
      network_type: networkType || 'Unknown',
      country: geo?.country || 'Unknown',
      region: geo?.region || 'Unknown',
      city: geo?.city || 'Unknown'
    };
    
    // Store the result in the database
    const result = await pool.query(
      `INSERT INTO speed_tests 
      (download_speed, upload_speed, latency, jitter, packet_loss, isp, server_location, ip_address, device_info, network_type, country, region, city)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        testData.download_speed, testData.upload_speed, testData.latency, testData.jitter,
        testData.packet_loss, testData.isp, testData.server_location, testData.ip_address,
        testData.device_info, testData.network_type, testData.country, testData.region, testData.city
      ]
    );
    
    // Return the test results and ID
    res.json({
      id: result.rows[0].id,
      timestamp: new Date(),
      download: testData.download_speed,
      upload: testData.upload_speed,
      latency: testData.latency,
      jitter: testData.jitter,
      packetLoss: testData.packet_loss,
      isp: testData.isp,
      serverLocation: testData.server_location,
      networkType: testData.network_type,
      region: testData.region,
      city: testData.city
    });
  } catch (error) {
    console.error('Error during speed test:', error);
    res.status(500).json({ error: 'Failed to perform speed test' });
  }
});

// Get test history for the current user (based on IP)
app.get('/api/history', async (req, res) => {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    const result = await pool.query(
      `SELECT * FROM speed_tests 
       WHERE ip_address = $1 
       ORDER BY timestamp DESC 
       LIMIT 100`,
      [ipAddress]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch test history' });
  }
});

// Get ISP rankings
app.get('/api/isp-rankings', async (req, res) => {
  try {
    const { region, metric = 'download_speed', timeRange = '24h' } = req.query;
    
    let timeFilter = '';
    if (timeRange === '24h') {
      timeFilter = 'timestamp > NOW() - INTERVAL \'24 HOURS\'';
    } else if (timeRange === '7d') {
      timeFilter = 'timestamp > NOW() - INTERVAL \'7 DAYS\'';
    } else if (timeRange === '30d') {
      timeFilter = 'timestamp > NOW() - INTERVAL \'30 DAYS\'';
    }
    
    let regionFilter = '';
    if (region && region !== 'all') {
      regionFilter = 'AND region = $1';
    }
    
    const query = `
      SELECT 
        isp,
        COUNT(*) as test_count,
        AVG(download_speed) as download_avg,
        AVG(upload_speed) as upload_avg,
        AVG(latency) as latency_avg,
        AVG(jitter) as jitter_avg,
        AVG(packet_loss) as packet_loss_avg
      FROM speed_tests
      WHERE ${timeFilter} ${regionFilter}
      GROUP BY isp
      HAVING COUNT(*) >= 5
      ORDER BY ${metric === 'latency' ? 'latency_avg ASC' : `${metric}_avg DESC`}
      LIMIT 10
    `;
    
    const params = region && region !== 'all' ? [region] : [];
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ISP rankings:', error);
    res.status(500).json({ error: 'Failed to fetch ISP rankings' });
  }
});

// Get time trend data for best/worst times
app.get('/api/time-trends', async (req, res) => {
  try {
    const { isp, region, metric = 'download_speed' } = req.query;
    
    let filters = ['timestamp > NOW() - INTERVAL \'7 DAYS\''];
    let params = [];
    let paramIndex = 1;
    
    if (isp && isp !== 'all') {
      filters.push(`isp = $${paramIndex}`);
      params.push(isp);
      paramIndex++;
    }
    
    if (region && region !== 'all') {
      filters.push(`region = $${paramIndex}`);
      params.push(region);
    }
    
    const filtersStr = filters.join(' AND ');
    
    const query = `
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour_of_day,
        AVG(${metric}) as avg_value,
        COUNT(*) as test_count
      FROM speed_tests
      WHERE ${filtersStr}
      GROUP BY hour_of_day
      ORDER BY hour_of_day
    `;
    
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching time trends:', error);
    res.status(500).json({ error: 'Failed to fetch time trends' });
  }
});

// Get available regions
app.get('/api/regions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT region FROM speed_tests ORDER BY region`
    );
    
    res.json(result.rows.map(row => row.region));
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

// Get available ISPs
app.get('/api/isps', async (req, res) => {
  try {
    const { region } = req.query;
    
    let query = 'SELECT DISTINCT isp FROM speed_tests';
    let params = [];
    
    if (region && region !== 'all') {
      query += ' WHERE region = $1';
      params.push(region);
    }
    
    query += ' ORDER BY isp';
    
    const result = await pool.query(query, params);
    
    res.json(result.rows.map(row => row.isp));
  } catch (error) {
    console.error('Error fetching ISPs:', error);
    res.status(500).json({ error: 'Failed to fetch ISPs' });
  }
});

// Calculate reliability scores
app.get('/api/reliability', async (req, res) => {
  try {
    const { isp, region } = req.query;
    
    let filters = ['timestamp > NOW() - INTERVAL \'30 DAYS\''];
    let params = [];
    let paramIndex = 1;
    
    if (isp && isp !== 'all') {
      filters.push(`isp = $${paramIndex}`);
      params.push(isp);
      paramIndex++;
    }
    
    if (region && region !== 'all') {
      filters.push(`region = $${paramIndex}`);
      params.push(region);
    }
    
    const filtersStr = filters.join(' AND ');
    
    const query = `
      WITH isp_stats AS (
        SELECT 
          isp,
          COUNT(*) as test_count,
          STDDEV(download_speed) as download_stddev,
          AVG(download_speed) as download_avg,
          COUNT(*) FILTER (WHERE download_speed < 1) as download_failures,
          STDDEV(upload_speed) as upload_stddev,
          AVG(upload_speed) as upload_avg,
          COUNT(*) FILTER (WHERE upload_speed < 1) as upload_failures,
          STDDEV(latency) as latency_stddev,
          AVG(latency) as latency_avg
        FROM speed_tests
        WHERE ${filtersStr}
        GROUP BY isp
        HAVING COUNT(*) >= 5
      )
      SELECT 
        isp,
        test_count,
        download_avg,
        upload_avg,
        latency_avg,
        download_stddev,
        upload_stddev,
        latency_stddev,
        download_failures,
        upload_failures,
        -- Reliability score formula (higher is better, 100 is max)
        ROUND(
          (100 - 
          ((download_stddev / NULLIF(download_avg, 0)) * 20 + 
           (upload_stddev / NULLIF(upload_avg, 0)) * 20 +
           (latency_stddev / NULLIF(latency_avg, 0)) * 20 +
           (download_failures::float / NULLIF(test_count, 0)) * 20 +
           (upload_failures::float / NULLIF(test_count, 0)) * 20))::numeric, 
        1) as reliability_score
      FROM isp_stats
      ORDER BY reliability_score DESC
      LIMIT 10
    `;
    
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error calculating reliability scores:', error);
    res.status(500).json({ error: 'Failed to calculate reliability scores' });
  }
});

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