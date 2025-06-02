const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced CORS middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5000'],
  methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Content-Length', 'Cache-Control', 'Pragma', 'Expires'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// Middleware for different content types
app.use('/api/upload', express.raw({ type: 'application/octet-stream', limit: '100mb' }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    server: process.env.SERVER_ID || 'speedtest-local',
    location: process.env.SERVER_LOCATION || 'localhost',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ping endpoints for latency testing
app.get('/api/ping', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  res.json({
    timestamp: Date.now(),
    server: 'netpulse-local',
    packet: req.query.packet || 0,
    requestTime: req.query.t || Date.now()
  });
});

app.head('/api/ping', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.status(200).end();
});

// Download endpoint - serves random data of specified size
app.get('/api/download/:sizeMB', (req, res) => {
  const sizeMB = parseInt(req.params.sizeMB) || 1;
  const sizeBytes = sizeMB * 1024 * 1024;
  
  console.log(`Download request: ${sizeMB}MB (${sizeBytes} bytes)`);
  
  // Validate size limits
  if (sizeMB > 100) {
    return res.status(400).json({ error: 'Maximum download size is 100MB' });
  }

  if (sizeMB < 0) {
    return res.status(400).json({ error: 'Size must be positive' });
  }

  // Set response headers
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': sizeBytes,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*'
  });

  try {
    // For small files, send all at once
    if (sizeBytes <= 1024 * 1024) { // 1MB or less
      const data = crypto.randomBytes(sizeBytes);
      res.send(data);
      return;
    }

    // For larger files, stream in chunks to avoid memory issues
    const chunkSize = 64 * 1024; // 64KB chunks
    let bytesWritten = 0;

    const writeChunk = () => {
      if (res.destroyed || res.headersSent && res.finished) {
        return; // Client disconnected
      }

      if (bytesWritten >= sizeBytes) {
        res.end();
        return;
      }

      const remainingBytes = sizeBytes - bytesWritten;
      const currentChunkSize = Math.min(chunkSize, remainingBytes);
      
      try {
        const chunk = crypto.randomBytes(currentChunkSize);
        bytesWritten += currentChunkSize;
        
        if (res.write(chunk)) {
          // Buffer not full, continue immediately
          setImmediate(writeChunk);
        } else {
          // Buffer full, wait for drain
          res.once('drain', writeChunk);
        }
      } catch (error) {
        console.error('Error generating chunk:', error);
        res.status(500).end();
      }
    };

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected during download');
    });

    writeChunk();

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed', details: error.message });
    }
  }
});

// Upload endpoint - receives and measures uploaded data
app.post('/api/upload', (req, res) => {
  const startTime = Date.now();
  let totalBytes = 0;

  console.log('Upload request started');

  // Handle different content types
  if (Buffer.isBuffer(req.body)) {
    // Raw binary data
    totalBytes = req.body.length;
    processUploadResult();
  } else {
    // Stream processing for larger uploads
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
    });

    req.on('end', processUploadResult);
  }

  req.on('error', (error) => {
    console.error('Upload error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Upload failed', details: error.message });
    }
  });

  function processUploadResult() {
    try {
      const duration = Date.now() - startTime;
      const speedMbps = totalBytes > 0 ? (totalBytes * 8) / (duration / 1000) / 1000000 : 0;

      console.log(`Upload completed: ${totalBytes} bytes in ${duration}ms (${speedMbps.toFixed(2)} Mbps)`);

      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });

      res.json({
        received: totalBytes,
        duration: duration,
        speed: Math.round(speedMbps * 100) / 100,
        timestamp: Date.now(),
        server: 'netpulse-local'
      });
    } catch (error) {
      console.error('Error processing upload result:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Upload processing failed', details: error.message });
      }
    }
  }
});

// Server info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    server: 'NETPULSE Speed Test Server',
    version: '1.0.0',
    location: process.env.SERVER_LOCATION || 'localhost',
    timestamp: Date.now(),
    capabilities: {
      maxDownloadMB: 100,
      maxUploadMB: 50,
      maxConcurrentConnections: 10,
      supportedMethods: ['download', 'upload', 'ping', 'latency']
    },
    endpoints: {
      ping: '/api/ping',
      download: '/api/download/:sizeMB',
      upload: '/api/upload',
      info: '/api/info',
      health: '/health'
    }
  });
});

// Test endpoint for connectivity verification
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Speed test server is running',
    timestamp: Date.now(),
    clientIP: req.ip,
    userAgent: req.headers['user-agent']
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: ['/health', '/api/ping', '/api/download/:sizeMB', '/api/upload', '/api/info', '/api/test']
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Speed Test Server running on port ${PORT}`);
  console.log(`📡 Available at: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Server info: http://localhost:${PORT}/api/info`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
});

module.exports = app;