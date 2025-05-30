const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('UserSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sessionToken: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: false
    },
    userAgent: {
      type: DataTypes.TEXT
    },
    location: {
      type: DataTypes.JSONB
    },
    deviceFingerprint: {
      type: DataTypes.STRING
    },
    lastActivity: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    totalTests: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'user_sessions',
    indexes: [
      { fields: ['sessionToken'] },
      { fields: ['ipAddress'] },
      { fields: ['lastActivity'] }
    ]
  });
};