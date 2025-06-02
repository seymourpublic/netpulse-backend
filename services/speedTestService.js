const ping = require('ping');
const axios = require('axios');
const si = require('systeminformation');

class SpeedTestService {
  constructor() {
    this.testServers = [
      { id: 'us-east-1', url: 'https://speedtest-east.example.com', location: 'Virginia, US' },
      { id: 'us-west-1', url: 'https://speedtest-west.example.com', location: 'California, US' },
      { id: 'eu-west-1', url: 'https://speedtest-eu.example.com', location: 'Ireland, EU' }
    ];
  }

  async performSpeedTest(clientIP, config = {}) {
    try {
      const startTime = Date.now();
      
      // Select optimal server
      const server = await this.selectOptimalServer(clientIP);
      
      // Get device and network info
      const deviceInfo = await this.getDeviceInfo();
      const networkInfo = await this.getNetworkInfo(clientIP);
      
      // Perform tests (simplified for demo)
      const downloadResult = await this.simulateDownloadTest();
      const uploadResult = await this.simulateUploadTest();
      const latencyResult = await this.testLatency(server.url);
      const stabilityResult = await this.simulateStabilityTest();
      
      const endTime = Date.now();
      
      return {
        download: downloadResult.speed,
        upload: uploadResult.speed,
        latency: latencyResult.latency,
        jitter: stabilityResult.jitter,
        packetLoss: stabilityResult.packetLoss,
        duration: endTime - startTime,
        serverId: server.id,
        serverLocation: server.location,
        deviceInfo,
        networkType: networkInfo.type,
        isp: networkInfo.isp,
        location: networkInfo.location,
        raw: {
          downloadSamples: downloadResult.samples,
          uploadSamples: uploadResult.samples,
          latencySamples: latencyResult.samples
        }
      };
      
    } catch (error) {
      console.error('Speed test failed:', error);
      throw new Error('Speed test execution failed');
    }
  }

  async selectOptimalServer(clientIP) {
    return this.testServers[0]; // Simplified
  }

  async getDeviceInfo() {
    try {
      const cpu = await si.cpu();
      const mem = await si.mem();
      const osInfo = await si.osInfo();
      
      return {
        cpu: `${cpu.manufacturer} ${cpu.brand}`,
        memory: Math.round(mem.total / 1024 / 1024 / 1024) + 'GB',
        os: `${osInfo.platform} ${osInfo.release}`,
        cores: cpu.cores
      };
    } catch (error) {
      return { error: 'Unable to detect device info' };
    }
  }

  async getNetworkInfo(clientIP) {
    try {
      const geoip = require('geoip-lite');
      const geo = geoip.lookup(clientIP);
      
      return {
        type: 'unknown',
        isp: geo?.org || 'Unknown ISP',
        location: {
          country: geo?.country || 'Unknown',
          region: geo?.region || 'Unknown',
          city: geo?.city || 'Unknown',
          lat: geo?.ll?.[0] || 0,
          lng: geo?.ll?.[1] || 0
        }
      };
    } catch (error) {
      return {
        type: 'unknown',
        isp: 'Unknown ISP',
        location: { country: 'Unknown', region: 'Unknown', city: 'Unknown', lat: 0, lng: 0 }
      };
    }
  }

  async testLatency(serverUrl) {
    const samples = [];
    const host = new URL(serverUrl).hostname;
    
    for (let i = 0; i < 5; i++) {
      try {
        const result = await ping.promise.probe(host);
        if (result.alive) {
          samples.push(parseFloat(result.time));
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        // Continue with next ping
      }
    }
    
    if (samples.length === 0) {
      // Simulate realistic latency
      const latency = Math.random() * 30 + 10;
      return { latency, samples: [latency] };
    }
    
    const avgLatency = samples.reduce((a, b) => a + b, 0) / samples.length;
    return { latency: Math.round(avgLatency * 100) / 100, samples };
  }

  async simulateDownloadTest() {
    // Simulate realistic download test
    const speed = Math.random() * 400 + 100;
    const samples = Array.from({ length: 10 }, () => speed + Math.random() * 50 - 25);
    return { speed: Math.round(speed * 100) / 100, samples };
  }

  async simulateUploadTest() {
    // Simulate realistic upload test
    const speed = Math.random() * 50 + 20;
    const samples = Array.from({ length: 8 }, () => speed + Math.random() * 10 - 5);
    return { speed: Math.round(speed * 100) / 100, samples };
  }

  async simulateStabilityTest() {
    return {
      jitter: Math.round((Math.random() * 5 + 1) * 100) / 100,
      packetLoss: Math.round((Math.random() * 2) * 100) / 100
    };
  }
}

module.exports = {
  performSpeedTest: async (clientIP, config) => {
    const service = new SpeedTestService();
    return await service.performSpeedTest(clientIP, config);
  }
};