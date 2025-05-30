const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ServerNode', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: false
    },
    port: {
      type: DataTypes.INTEGER,
      defaultValue: 80
    },
    provider: {
      type: DataTypes.STRING
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastHealthCheck: {
      type: DataTypes.DATE
    },
    averageResponseTime: {
      type: DataTypes.FLOAT
    },
    capacity: {
      type: DataTypes.INTEGER,
      defaultValue: 100
    },
    currentLoad: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'server_nodes',
    indexes: [
      { fields: ['location'] },
      { fields: ['isActive'] }
    ]
  });
};