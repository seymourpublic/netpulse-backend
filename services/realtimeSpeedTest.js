class RealtimeSpeedTestEngine extends CustomSpeedTestEngine {
  constructor(websocketConnection) {
    super();
    this.ws = websocketConnection;
    this.testId = null;
  }

  // Real-time speed test with progress updates
  async runRealtimeTest(clientIP, config = {}) {
    this.testId = crypto.randomUUID();
    
    try {
      this.broadcastUpdate('test_started', { 
        testId: this.testId,
        stages: ['server_selection', 'latency', 'download', 'upload', 'packet_loss', 'analysis']
      });

      // Stage 1: Server Selection
      this.broadcastUpdate('stage_started', { stage: 'server_selection', progress: 0 });
      const server = await this.selectOptimalServer(clientIP);
      this.broadcastUpdate('stage_completed', { 
        stage: 'server_selection', 
        progress: 16.67,
        data: { server: server.id, location: server.location, latency: server.latency }
      });

      // Stage 2: Latency Test
      this.broadcastUpdate('stage_started', { stage: 'latency', progress: 16.67 });
      const latencyResults = await this.performRealtimeLatencyTest(server, config);
      this.broadcastUpdate('stage_completed', { 
        stage: 'latency', 
        progress: 33.33,
        data: latencyResults
      });

      // Stage 3: Download Test
      this.broadcastUpdate('stage_started', { stage: 'download', progress: 33.33 });
      const downloadResults = await this.performRealtimeDownloadTest(server, config);
      this.broadcastUpdate('stage_completed', { 
        stage: 'download', 
        progress: 58.33,
        data: downloadResults
      });

      // Stage 4: Upload Test
      this.broadcastUpdate('stage_started', { stage: 'upload', progress: 58.33 });
      const uploadResults = await this.performRealtimeUploadTest(server, config);
      this.broadcastUpdate('stage_completed', { 
        stage: 'upload', 
        progress: 83.33,
        data: uploadResults
      });

      // Stage 5: Packet Loss Test
      this.broadcastUpdate('stage_started', { stage: 'packet_loss', progress: 83.33 });
      const packetLoss = await this.performPacketLossTest(server, config);
      this.broadcastUpdate('stage_completed', { 
        stage: 'packet_loss', 
        progress: 91.67,
        data: { packetLoss }
      });

      // Stage 6: Final Analysis
      this.broadcastUpdate('stage_started', { stage: 'analysis', progress: 91.67 });
      const finalResults = {
        testId: this.testId,
        server,
        results: {
          download: downloadResults,
          upload: uploadResults,
          latency: latencyResults,
          packetLoss
        }
      };

      finalResults.results.quality = this.calculateQualityMetrics(finalResults.results);
      
      this.broadcastUpdate('test_completed', { 
        progress: 100,
        results: finalResults
      });

      return finalResults;

    } catch (error) {
      this.broadcastUpdate('test_error', { 
        error: error.message,
        testId: this.testId
      });
      throw error;
    }
  }

  // Real-time latency test with live updates
  async performRealtimeLatencyTest(server, config) {
    const samples = [];
    const testCount = config.latencyTests || 10;

    for (let i = 0; i < testCount; i++) {
      const start = performance.now();
      
      try {
        const response = await fetch('http://\${server.host}/api/ping?t=\${Date.now()}', {
          timeout: 3000,
          cache: 'no-cache'
        });

        if (response.ok) {
          const latency = performance.now() - start;
          samples.push(latency);
          
          // Real-time update
          this.broadcastUpdate('latency_sample', {
            sample: latency,
            count: i + 1,
            total: testCount,
            currentAvg: samples.reduce((a, b) => a + b, 0) / samples.length
          });
        }
      } catch (error) {
        this.broadcastUpdate('latency_error', { 
          sample: i + 1, 
          error: error.message 
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const result = this.calculateLatencyStats(samples);
    return result;
  }

  // Real-time download test with speed updates
  async performRealtimeDownloadTest(server, config) {
    const samples = [];
    const duration = (config.testDuration || 15) * 1000;
    const startTime = performance.now();
    let lastUpdate = startTime;

    // Download with real-time speed monitoring
    const downloadPromise = this.performDownloadWithCallback(server, duration, (speedSample) => {
      samples.push(speedSample);
      
      // Update every 250ms to avoid flooding
      const now = performance.now();
      if (now - lastUpdate > 250) {
        const currentSpeed = samples.slice(-4).reduce((sum, s) => sum + s.speed, 0) / Math.min(4, samples.length);
        
        this.broadcastUpdate('download_progress', {
          currentSpeed: Math.round(currentSpeed * 100) / 100,
          avgSpeed: samples.reduce((sum, s) => sum + s.speed, 0) / samples.length,
          samples: samples.length,
          elapsed: now - startTime
        });
        
        lastUpdate = now;
      }
    });

    const results = await downloadPromise;
    return results;
  }

  // Real-time upload test
  async performRealtimeUploadTest(server, config) {
    const samples = [];
    const duration = (config.testDuration || 10) * 1000;
    const startTime = performance.now();
    let lastUpdate = startTime;

    const uploadPromise = this.performUploadWithCallback(server, duration, (speedSample) => {
      samples.push(speedSample);
      
      const now = performance.now();
      if (now - lastUpdate > 250) {
        const currentSpeed = samples.slice(-4).reduce((sum, s) => sum + s.speed, 0) / Math.min(4, samples.length);
        
        this.broadcastUpdate('upload_progress', {
          currentSpeed: Math.round(currentSpeed * 100) / 100,
          avgSpeed: samples.reduce((sum, s) => sum + s.speed, 0) / samples.length,
          samples: samples.length,
          elapsed: now - startTime
        });
        
        lastUpdate = now;
      }
    });

    const results = await uploadPromise;
    return results;
  }

  // Download with callback for real-time updates
  async performDownloadWithCallback(server, duration, callback) {
    const startTime = performance.now();
    const connections = 4;
    
    const downloadPromises = Array.from({ length: connections }, (_, i) => 
      this.downloadStreamWithCallback(server, duration, `stream-${i}`, callback)
    );

    await Promise.all(downloadPromises);
    
    // Return aggregated results
    return {
      speed: this.lastCalculatedDownloadSpeed || 0,
      consistency: this.lastCalculatedConsistency || 0,
      connections
    };
  }

  // Upload with callback
  async performUploadWithCallback(server, duration, callback) {
    const startTime = performance.now();
    const connections = 2;
    
    const uploadPromises = Array.from({ length: connections }, (_, i) => 
      this.uploadStreamWithCallback(server, duration, `stream-${i}`, callback)
    );

    await Promise.all(uploadPromises);
    
    return {
      speed: this.lastCalculatedUploadSpeed || 0,
      consistency: this.lastCalculatedUploadConsistency || 0,
      connections
    };
  }

  // WebSocket broadcast helper
  broadcastUpdate(eventType, data) {
    if (this.ws && this.ws.readyState === 1) { // WebSocket.OPEN
      this.ws.send(JSON.stringify({
        type: 'speedtest_update',
        event: eventType,
        testId: this.testId,
        timestamp: Date.now(),
        data
      }));
    }
  }
}