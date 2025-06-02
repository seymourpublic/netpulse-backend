const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Ping endpoint for latency testing
router.get('/ping', (req, res) => {
  res.json({
    timestamp: Date.now(),
    server: 'netpulse-primary',
    packet: req.query.packet || 0
  });
});

router.head('/ping', (req, res) => {
  res.status(200).end();
});

// Download endpoint - serves random data of specified size
router.get('/download/:sizeMB', (req, res) => {
  const sizeMB = parseInt(req.params.sizeMB) || 1;
  const sizeBytes = sizeMB * 1024 * 1024;
  
  // Validate size limits
  if (sizeMB > 100) {
    return res.status(400).json({ error: 'Maximum download size is 100MB' });
  }

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': sizeBytes,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  // Stream random data in chunks to avoid memory issues
  const chunkSize = 64 * 1024; // 64KB chunks
  let bytesWritten = 0;

  const writeChunk = () => {
    if (bytesWritten >= sizeBytes) {
      res.end();
      return;
    }

    const remainingBytes = sizeBytes - bytesWritten;
    const currentChunkSize = Math.min(chunkSize, remainingBytes);
    const chunk = crypto.randomBytes(currentChunkSize);
    
    bytesWritten += currentChunkSize;
    
    if (res.write(chunk)) {
      // If the write was successful and the buffer isn't full, continue immediately
      process.nextTick(writeChunk);
    } else {
      // If the buffer is full, wait for drain event
      res.once('drain', writeChunk);
    }
  };

  writeChunk();
});

// Upload endpoint - receives and measures uploaded data
router.post('/upload', (req, res) => {
  const startTime = Date.now();
  let totalBytes = 0;

  req.on('data', (chunk) => {
    totalBytes += chunk.length;
  });

  req.on('end', () => {
    const duration = Date.now() - startTime;
    const speedMbps = (totalBytes * 8) / (duration / 1000) / 1000000;

    res.json({
      received: totalBytes,
      duration: duration,
      speed: Math.round(speedMbps * 100) / 100,
      timestamp: Date.now()
    });
  });

  req.on('error', (error) => {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  });
});

// Server info endpoint
router.get('/info', (req, res) => {
  res.json({
    server: 'NETPULSE Speed Test Server',
    version: '1.0.0',
    location: process.env.SERVER_LOCATION || 'Unknown',
    timestamp: Date.now(),
    capabilities: {
      maxDownloadMB: 100,
      maxUploadMB: 50,
      maxConcurrentConnections: 10
    }
  });
});

module.exports = router;