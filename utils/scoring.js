function calculateQualityScore(testResult) {
  const { download, upload, latency, jitter, packetLoss } = testResult;

  // Scoring weights
  const weights = {
    download: 0.4,
    upload: 0.25,
    latency: 0.2,
    jitter: 0.1,
    packetLoss: 0.05
  };

  // Score calculations (0-100 scale)
  const downloadScore = Math.min(100, (download / 1000) * 100); // 1Gbps = 100 points
  const uploadScore = Math.min(100, (upload / 100) * 100);      // 100Mbps = 100 points
  const latencyScore = Math.max(0, 100 - latency);              // Lower is better
  const jitterScore = Math.max(0, 100 - jitter * 10);           // Lower is better
  const packetLossScore = Math.max(0, 100 - packetLoss * 10);   // Lower is better

  const qualityScore = (
    downloadScore * weights.download +
    uploadScore * weights.upload +
    latencyScore * weights.latency +
    jitterScore * weights.jitter +
    packetLossScore * weights.packetLoss
  );

  return Math.round(qualityScore * 100) / 100;
}

function getQualityGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

module.exports = {
  calculateQualityScore,
  getQualityGrade
};