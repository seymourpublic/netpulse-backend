const { ISP, ServerNode, sequelize } = require('../models');

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...');
    
    await sequelize.authenticate();
    
    // Seed ISPs
    const isps = [
      {
        name: 'Verizon',
        displayName: 'Verizon Fios',
        country: 'US',
        region: 'Northeast',
        asn: 701,
        website: 'https://www.verizon.com',
        averageDownload: 940,
        averageUpload: 880,
        averageLatency: 12,
        reliabilityScore: 96
      },
      {
        name: 'Comcast',
        displayName: 'Xfinity',
        country: 'US',
        region: 'National',
        asn: 7922,
        website: 'https://www.xfinity.com',
        averageDownload: 350,
        averageUpload: 35,
        averageLatency: 18,
        reliabilityScore: 89
      },
      {
        name: 'AT&T',
        displayName: 'AT&T Fiber',
        country: 'US',
        region: 'South',
        asn: 7018,
        website: 'https://www.att.com',
        averageDownload: 920,
        averageUpload: 880,
        averageLatency: 15,
        reliabilityScore: 94
      },
      {
        name: 'Spectrum',
        displayName: 'Charter Spectrum',
        country: 'US',
        region: 'National',
        asn: 20115,
        website: 'https://www.spectrum.com',
        averageDownload: 200,
        averageUpload: 10,
        averageLatency: 22,
        reliabilityScore: 85
      },
      {
        name: 'Cox',
        displayName: 'Cox Communications',
        country: 'US',
        region: 'Southwest',
        asn: 22773,
        website: 'https://www.cox.com',
        averageDownload: 150,
        averageUpload: 10,
        averageLatency: 25,
        reliabilityScore: 82
      }
    ];

    for (const ispData of isps) {
      await ISP.findOrCreate({
        where: { name: ispData.name },
        defaults: ispData
      });
    }

    // Seed server nodes
    const serverNodes = [
      {
        name: 'US East (Virginia)',
        location: {
          city: 'Ashburn',
          region: 'Virginia',
          country: 'US',
          lat: 39.0458,
          lng: -77.4875
        },
        ipAddress: '54.239.28.85',
        provider: 'AWS',
        capacity: 1000
      },
      {
        name: 'US West (California)',
        location: {
          city: 'San Francisco',
          region: 'California',
          country: 'US',
          lat: 37.7749,
          lng: -122.4194
        },
        ipAddress: '54.241.131.99',
        provider: 'AWS',
        capacity: 1000
      },
      {
        name: 'Europe (Ireland)',
        location: {
          city: 'Dublin',
          region: 'Leinster',
          country: 'IE',
          lat: 53.3498,
          lng: -6.2603
        },
        ipAddress: '54.229.214.131',
        provider: 'AWS',
        capacity: 800
      },
      {
        name: 'Asia Pacific (Tokyo)',
        location: {
          city: 'Tokyo',
          region: 'Kanto',
          country: 'JP',
          lat: 35.6762,
          lng: 139.6503
        },
        ipAddress: '54.248.220.139',
        provider: 'AWS',
        capacity: 600
      }
    ];

    for (const nodeData of serverNodes) {
      await ServerNode.findOrCreate({
        where: { name: nodeData.name },
        defaults: nodeData
      });
    }

    console.log(`✅ Seeded ${isps.length} ISPs and ${serverNodes.length} server nodes`);
    console.log('🎉 Database seeding completed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };