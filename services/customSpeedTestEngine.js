const crypto = require('crypto');
const { performance } = require('perf_hooks');

class CustomSpeedTestEngine {
  constructor() {
    this.testServers = [
      { id: 'primary', host: 'speedtest1.netpulse.com', location: 'US-East' },
      { id: 'secondary', host: 'speedtest2.netpulse.com', location: 'US-West' },
      { id: 'fallback', host: 'localhost', location: 'Local' }
    ];
    
    this.testConfig = {
      downloadSizes: [1, 5, 10, 25], // MB
      uploadSizes: [1, 5, 10], // MB
      latencyTests: 10,
      testDuration: 15, // seconds
      concurrentConnections: 4,
      warmupTests: 2
    };
  }

  // Main speed test orchestrator
  async runComprehensiveTest(clientIP, customConfig = {}) {
    const config = { ...this.testConfig, ...customConfig };
    const results = {
      testId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      clientIP,
      server: null,
      results: {
        download: { speed: 0, consistency: 0, samples: [] },
        upload: { speed: 0, consistency: 0, samples: [] },
        latency: { avg: 0, min: 0, max: 0, jitter: 0, samples: [] },
        packetLoss: 0,
        quality: { score: 0, grade: 'F' }
      },
      metadata: {
        duration: 0,
        testStages: [],
        networkConditions: {},
        reliability: 0
      }
    };

    const testStartTime = performance.now();

    try {
      // Stage 1: Server Selection
      console.log('🔍 Stage 1: Selecting optimal server...');
      results.server = await this.selectOptimalServer(clientIP);
      results.metadata.testStages.push({ stage: 'server_selection', duration: performance.now() - testStartTime });

      // Stage 2: Latency & Connectivity Test
      console.log('📡 Stage 2: Testing latency and connectivity...');
      const latencyStart = performance.now();
      results.results.latency = await this.performLatencyTest(results.server, config);
      results.metadata.testStages.push({ stage: 'latency_test', duration: performance.now() - latencyStart });

      // Stage 3: Download Speed Test
      console.log('⬇️  Stage 3: Testing download speed...');
      const downloadStart = performance.now();
      results.results.download = await this.performDownloadTest(results.server, config);
      results.metadata.testStages.push({ stage: 'download_test', duration: performance.now() - downloadStart });

      // Stage 4: Upload Speed Test
      console.log('⬆️  Stage 4: Testing upload speed...');
      const uploadStart = performance.now();
      results.results.upload = await this.performUploadTest(results.server, config);
      results.metadata.testStages.push({ stage: 'upload_test', duration: performance.now() - uploadStart });

      // Stage 5: Packet Loss Test
      console.log('📦 Stage 5: Testing packet loss...');
      const packetStart = performance.now();
      results.results.packetLoss = await this.performPacketLossTest(results.server, config);
      results.metadata.testStages.push({ stage: 'packet_loss_test', duration: performance.now() - packetStart });

      // Stage 6: Quality Analysis
      console.log('📊 Stage 6: Calculating quality metrics...');
      results.results.quality = this.calculateQualityMetrics(results.results);
      results.metadata.reliability = this.calculateReliabilityScore(results.results);

      results.metadata.duration = performance.now() - testStartTime;
      console.log(`✅ Speed test completed in ${Math.round(results.metadata.duration)}ms`);

      return results;

    } catch (error) {
      console.error('❌ Speed test failed:', error);
      throw new Error(`Speed test failed: ${error.message}`);
    }
  }

  // Intelligent server selection based on latency
  async selectOptimalServer(clientIP) {
    const serverPromises = this.testServers.map(async (server) => {
      try {
        const latency = await this.quickLatencyTest(server);
        return { ...server, latency, available: true };
      } catch (error) {
        return { ...server, latency: 9999, available: false };
      }
    });

    const serverResults = await Promise.all(serverPromises);
    const availableServers = serverResults.filter(s => s.available);
    
    if (availableServers.length === 0) {
      throw new Error('No speed test servers available');
    }

    // Select server with lowest latency
    const optimalServer = availableServers.reduce((best, current) => 
      current.latency < best.latency ? current : best
    );

    console.log(`🎯 Selected server: ${optimalServer.id} (${optimalServer.latency}ms latency)`);
    return optimalServer;
  }

  // Quick latency test for server selection
  async quickLatencyTest(server) {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      try {
        const response = await fetch(`http://${server.host}/ping`, {
          method: 'HEAD',
          timeout: 5000
        });
        if (response.ok) {
          samples.push(performance.now() - start);
        }
      } catch (error) {
        throw new Error(`Server ${server.id} unreachable`);
      }
    }
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }

  // Comprehensive latency testing
  async performLatencyTest(server, config) {
    const samples = [];
    const testCount = config.latencyTests || 10;

    for (let i = 0; i < testCount; i++) {
      const start = performance.now();
      try {
        const response = await fetch(`http://${server.host}/api/ping?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-cache',
          timeout: 3000
        });

        if (response.ok) {
          const latency = performance.now() - start;
          samples.push(latency);
        }
      } catch (error) {
        console.warn(`Latency test ${i + 1} failed`);
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (samples.length === 0) {
      throw new Error('All latency tests failed');
    }

    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    
    // Calculate jitter (standard deviation)
    const variance = samples.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / samples.length;
    const jitter = Math.sqrt(variance);

    return {
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      jitter: Math.round(jitter * 100) / 100,
      samples: samples.map(s => Math.round(s * 100) / 100)
    };
  }

  // Advanced download speed testing with multiple connections
  async performDownloadTest(server, config) {
    const samples = [];
    const testDuration = (config.testDuration || 15) * 1000; // Convert to ms
    const connections = config.concurrentConnections || 4;
    const startTime = performance.now();

    // Warmup phase
    console.log('🔥 Download warmup...');
    await this.downloadWarmup(server);

    console.log(`📥 Starting download test with ${connections} connections...`);
    
    const downloadPromises = Array.from({ length: connections }, (_, i) => 
      this.performSingleDownloadStream(server, testDuration, `stream-${i}`, samples)
    );

    await Promise.all(downloadPromises);

    // Calculate statistics
    const validSamples = samples.filter(s => s.speed > 0);
    if (validSamples.length === 0) {
      throw new Error('Download test failed - no valid samples');
    }

    const speeds = validSamples.map(s => s.speed);
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const consistency = this.calculateConsistency(speeds);

    return {
      speed: Math.round(avgSpeed * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      samples: validSamples,
      connections: connections,
      duration: performance.now() - startTime
    };
  }

  // Single download stream for parallel testing
  async performSingleDownloadStream(server, duration, streamId, samples) {
    const startTime = performance.now();
    let totalBytes = 0;
    let chunkSizes = [1, 5, 10, 25]; // MB sizes to test
    let chunkIndex = 0;

    while (performance.now() - startTime < duration) {
      const chunkSize = chunkSizes[chunkIndex % chunkSizes.length];
      const chunkStart = performance.now();

      try {
        const response = await fetch(`http://${server.host}/api/download/${chunkSize}?stream=${streamId}&t=${Date.now()}`, {
          timeout: 10000
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        // Read the response body
        const reader = response.body.getReader();
        let bytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          totalBytes += value.length;
        }

        const chunkDuration = (performance.now() - chunkStart) / 1000; // seconds
        const chunkSpeed = (bytes * 8) / (chunkDuration * 1000000); // Mbps

        samples.push({
          timestamp: Date.now(),
          speed: chunkSpeed,
          bytes: bytes,
          duration: chunkDuration,
          stream: streamId
        });

        chunkIndex++;

      } catch (error) {
        console.warn(`Download chunk failed for ${streamId}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause before retry
      }
    }
  }

  // Download warmup to establish connections
  async downloadWarmup(server) {
    try {
      const response = await fetch(`http://${server.host}/api/download/1?warmup=true`, {
        timeout: 5000
      });
      if (response.ok) {
        await response.arrayBuffer(); // Consume the response
      }
    } catch (error) {
      console.warn('Download warmup failed:', error.message);
    }
  }

  // Advanced upload speed testing
  async performUploadTest(server, config) {
    const samples = [];
    const testDuration = (config.testDuration || 10) * 1000; // Shorter for upload
    const connections = Math.min(config.concurrentConnections || 2, 2); // Limit upload connections
    const startTime = performance.now();

    console.log(`📤 Starting upload test with ${connections} connections...`);

    const uploadPromises = Array.from({ length: connections }, (_, i) => 
      this.performSingleUploadStream(server, testDuration, `stream-${i}`, samples)
    );

    await Promise.all(uploadPromises);

    const validSamples = samples.filter(s => s.speed > 0);
    if (validSamples.length === 0) {
      throw new Error('Upload test failed - no valid samples');
    }

    const speeds = validSamples.map(s => s.speed);
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const consistency = this.calculateConsistency(speeds);

    return {
      speed: Math.round(avgSpeed * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      samples: validSamples,
      connections: connections,
      duration: performance.now() - startTime
    };
  }

  // Single upload stream
  async performSingleUploadStream(server, duration, streamId, samples) {
    const startTime = performance.now();
    let chunkSizes = [1, 2, 5]; // MB sizes for upload
    let chunkIndex = 0;

    while (performance.now() - startTime < duration) {
      const chunkSize = chunkSizes[chunkIndex % chunkSizes.length];
      const chunkStart = performance.now();
      const uploadData = this.generateUploadData(chunkSize);

      try {
        const response = await fetch(`http://${server.host}/api/upload?stream=${streamId}&size=${chunkSize}`, {
          method: 'POST',
          body: uploadData,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': uploadData.length.toString()
          },
          timeout: 15000
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const chunkDuration = (performance.now() - chunkStart) / 1000;
        const chunkSpeed = (uploadData.length * 8) / (chunkDuration * 1000000); // Mbps

        samples.push({
          timestamp: Date.now(),
          speed: chunkSpeed,
          bytes: uploadData.length,
          duration: chunkDuration,
          stream: streamId
        });

        chunkIndex++;

      } catch (error) {
        console.warn(`Upload chunk failed for ${streamId}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  // Generate random data for upload testing
  generateUploadData(sizeMB) {
    const sizeBytes = sizeMB * 1024 * 1024;
    const chunks = [];
    const chunkSize = 64 * 1024; // 64KB chunks

    for (let i = 0; i < sizeBytes; i += chunkSize) {
      const currentChunkSize = Math.min(chunkSize, sizeBytes - i);
      chunks.push(crypto.randomBytes(currentChunkSize));
    }

    return Buffer.concat(chunks);
  }

  // Packet loss testing using multiple small requests
  async performPacketLossTest(server, config) {
    const totalPackets = 50;
    const timeout = 3000;
    let successfulPackets = 0;

    const promises = Array.from({ length: totalPackets }, async (_, i) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`http://${server.host}/api/ping?packet=${i}&t=${Date.now()}`, {
          signal: controller.signal,
          cache: 'no-cache'
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          successfulPackets++;
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    });

    await Promise.allSettled(promises);

    const packetLoss = ((totalPackets - successfulPackets) / totalPackets) * 100;
    return Math.round(packetLoss * 100) / 100;
  }

  // Calculate speed consistency (lower variation = higher consistency)
  calculateConsistency(speeds) {
    if (speeds.length < 2) return 100;

    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((acc, speed) => acc + Math.pow(speed - mean, 2), 0) / speeds.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to consistency score (0-100, higher is better)
    const coefficientOfVariation = stdDev / mean;
    const consistency = Math.max(0, 100 - (coefficientOfVariation * 100));
    
    return consistency;
  }

  // Comprehensive quality scoring
  calculateQualityMetrics(results) {
    const weights = {
      download: 0.35,
      upload: 0.25,
      latency: 0.25,
      packetLoss: 0.10,
      consistency: 0.05
    };

    // Scoring functions (0-100 scale)
    const downloadScore = Math.min(100, (results.download.speed / 1000) * 100); // 1Gbps = 100
    const uploadScore = Math.min(100, (results.upload.speed / 100) * 100);      // 100Mbps = 100
    const latencyScore = Math.max(0, 100 - results.latency.avg);                // Lower is better
    const packetLossScore = Math.max(0, 100 - (results.packetLoss * 10));       // Lower is better
    const consistencyScore = (results.download.consistency + results.upload.consistency) / 2;

    const overallScore = (
      downloadScore * weights.download +
      uploadScore * weights.upload +
      latencyScore * weights.latency +
      packetLossScore * weights.packetLoss +
      consistencyScore * weights.consistency
    );

    const grade = this.getQualityGrade(overallScore);

    return {
      score: Math.round(overallScore * 100) / 100,
      grade,
      breakdown: {
        download: Math.round(downloadScore * 100) / 100,
        upload: Math.round(uploadScore * 100) / 100,
        latency: Math.round(latencyScore * 100) / 100,
        packetLoss: Math.round(packetLossScore * 100) / 100,
        consistency: Math.round(consistencyScore * 100) / 100
      }
    };
  }

  // Calculate overall reliability score
  calculateReliabilityScore(results) {
    const factors = {
      latencyStability: this.calculateConsistency(results.latency.samples),
      downloadConsistency: results.download.consistency,
      uploadConsistency: results.upload.consistency,
      packetDelivery: 100 - results.packetLoss
    };

    const reliability = Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;
    return Math.round(reliability * 100) / 100;
  }

  // Quality grade mapping
  getQualityGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D';
    return 'F';
  }
}

module.exports = CustomSpeedTestEngine;