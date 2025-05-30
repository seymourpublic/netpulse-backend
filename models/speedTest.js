const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('SpeedTest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    downloadSpeed: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: { min: 0 }
    },
    uploadSpeed: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: { min: 0 }
    },
    latency: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: { min: 0 }
    },
    jitter: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: { min: 0 }
    },
    packetLoss: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 100 }
    },
    testDuration: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: false
    },
    userAgent: {
      type: DataTypes.TEXT
    },
    deviceInfo: {
      type: DataTypes.JSONB
    },
    networkType: {
      type: DataTypes.ENUM('wifi', 'ethernet', 'mobile', 'unknown'),
      defaultValue: 'unknown'
    },
    location: {
      type: DataTypes.JSONB // { city, country, lat, lng, region }
    },
    testServerId: {
      type: DataTypes.STRING
    },
    rawResults: {
      type: DataTypes.JSONB // Store raw speed test data
    },
    qualityScore: {
      type: DataTypes.FLOAT,
      validate: { min: 0, max: 100 }
    },
    ispId: {
      type: DataTypes.UUID,
      references: {
        model: 'ISPs',
        key: 'id'
      }
    },
    sessionId: {
      type: DataTypes.UUID,
      references: {
        model: 'UserSessions',
        key: 'id'
      }
    },
    serverNodeId: {
      type: DataTypes.UUID,
      references: {
        model: 'ServerNodes',
        key: 'id'
      }
    }
  }, {
    tableName: 'speed_tests',
    indexes: [
      { fields: ['createdAt'] },
      { fields: ['ispId'] },
      { fields: ['location'] },
      { fields: ['qualityScore'] },
      { fields: ['networkType'] }
    ]
  });
};