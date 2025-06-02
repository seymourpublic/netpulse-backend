const mongoose = require('mongoose');
const { ISP, ServerNode } = require('../models');
require('dotenv').config();

async function seedDatabase() {
  try {
    console.log('🌱 Seeding MongoDB database...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/netpulse');
    
    // Seed ISPs
    const isps = [
      {
        name: 'Verizon',
        displayName: 'Verizon Fios',
        country: 'US',
        region: 'Northeast',
        asn: 701,
        website: 'https://www.verizon.com',
        statistics: {
          averageDownload: 940,
          averageUpload: 880,
          averageLatency: 12,
          reliabilityScore: 96
        }
      },
      {
        name: 'Comcast',
        displayName: 'Xfinity',
        country: 'US',
        region: 'National',
        asn: 7922,
        website: 'https://www.xfinity.com',
        statistics: {
          averageDownload: 350,
          averageUpload: 35,
          averageLatency: 18,
          reliabilityScore: 89
        }
      },
      {
        name: 'AT&T',
        displayName: 'AT&T Fiber',
        country: 'US',
        region: 'South',
        asn: 7018,
        website: 'https://www.att.com',
        statistics: {
          averageDownload: 920,
          averageUpload: 880,
          averageLatency: 15,
          reliabilityScore: 94
        }
      }
    ];

    for (const ispData of isps) {
      await ISP.findOneAndUpdate(
        { name: ispData.name },
        ispData,
        { upsert: true, new: true }
      );
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
      }
    ];

    for (const nodeData of serverNodes) {
      await ServerNode.findOneAndUpdate(
        { name: nodeData.name },
        nodeData,
        { upsert: true, new: true }
      );
    }

    console.log(`✅ Seeded ${isps.length} ISPs and ${serverNodes.length} server nodes`);
    console.log('🎉 MongoDB database seeding completed');
    
    await mongoose.disconnect();
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
