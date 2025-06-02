// utils/scoring.js

/**
 * Calculate quality score based on speed test results
 * @param {Object} testResult - Speed test results
 * @returns {number} Quality score (0-100)
 */
function calculateQualityScore(testResult) {
  try {
    const weights = {
      download: 0.35,
      upload: 0.25,
      latency: 0.25,
      packetLoss: 0.10,
      jitter: 0.05
    };

    // Scoring functions (0-100 scale)
    const downloadScore = Math.min(100, (testResult.download || 0) / 10); // 1Gbps = 100
    const uploadScore = Math.min(100, (testResult.upload || 0) / 5);      // 500Mbps = 100
    const latencyScore = Math.max(0, 100 - (testResult.latency || 0));     // Lower is better
    const packetLossScore = Math.max(0, 100 - (testResult.packetLoss || 0) * 10); // Lower is better
    const jitterScore = Math.max(0, 100 - (testResult.jitter || 0) * 2);   // Lower is better

    const overallScore = (
      downloadScore * weights.download +
      uploadScore * weights.upload +
      latencyScore * weights.latency +
      packetLossScore * weights.packetLoss +
      jitterScore * weights.jitter
    );

    return Math.round(overallScore * 100) / 100;
  } catch (error) {
    console.error('Quality score calculation error:', error);
    return 0;
  }
}

/**
 * Get quality grade based on score
 * @param {number} score - Quality score (0-100)
 * @returns {string} Grade (A+ to F)
 */
function getQualityGrade(score) {
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

/**
 * Calculate reliability score based on speed consistency
 * @param {Array} speeds - Array of speed measurements
 * @param {Array} packetLosses - Array of packet loss measurements
 * @returns {number} Reliability score (0-100)
 */
function calculateReliabilityScore(speeds, packetLosses) {
  try {
    if (!speeds || speeds.length === 0) return 0;

    // Calculate consistency (lower variance = higher score)
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speeds.length;
    const consistencyScore = Math.max(0, 100 - (variance / mean) * 100);

    // Calculate packet loss penalty
    let packetLossScore = 100;
    if (packetLosses && packetLosses.length > 0) {
      const avgPacketLoss = packetLosses.reduce((a, b) => a + b, 0) / packetLosses.length;
      packetLossScore = Math.max(0, 100 - avgPacketLoss * 10);
    }

    return Math.round((consistencyScore * 0.7 + packetLossScore * 0.3) * 100) / 100;
  } catch (error) {
    console.error('Reliability score calculation error:', error);
    return 0;
  }
}

/**
 * Calculate speed consistency score
 * @param {Array} speeds - Array of speed measurements
 * @returns {number} Consistency score (0-100)
 */
function calculateSpeedConsistency(speeds) {
  try {
    if (!speeds || speeds.length < 2) return 100;

    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((acc, speed) => acc + Math.pow(speed - mean, 2), 0) / speeds.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to consistency score (0-100, higher is better)
    const coefficientOfVariation = stdDev / mean;
    const consistency = Math.max(0, 100 - (coefficientOfVariation * 100));
    
    return Math.round(consistency * 100) / 100;
  } catch (error) {
    console.error('Speed consistency calculation error:', error);
    return 0;
  }
}

module.exports = {
  calculateQualityScore,
  getQualityGrade,
  calculateReliabilityScore,
  calculateSpeedConsistency
};