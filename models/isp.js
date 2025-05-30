const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ISP', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    displayName: {
      type: DataTypes.STRING
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false
    },
    region: {
      type: DataTypes.STRING
    },
    asn: {
      type: DataTypes.INTEGER,
      unique: true
    },
    website: {
      type: DataTypes.STRING
    },
    supportContact: {
      type: DataTypes.STRING
    },
    averageDownload: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    averageUpload: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    averageLatency: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    reliabilityScore: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: { min: 0, max: 100 }
    },
    totalTests: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastUpdated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    metadata: {
      type: DataTypes.JSONB
    }
  }, {
    tableName: 'isps',
    indexes: [
      { fields: ['country'] },
      { fields: ['reliabilityScore'] },
      { fields: ['averageDownload'] },
      { fields: ['asn'] }
    ]
  });
};
