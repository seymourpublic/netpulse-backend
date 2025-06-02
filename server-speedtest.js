const express = require('express');
const cors = require('cors');
//const speedTestRoutes = require('./speedTestServer');
const speedTestRoutes = require('./routes/speedTestServer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));
app.use(express.json());

// Routes
app.use('/api', speedTestRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    server: process.env.SERVER_ID || 'speedtest',
    location: process.env.SERVER_LOCATION || 'Unknown',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Speed Test Server (${process.env.SERVER_ID}) running on port ${PORT}`);
});
