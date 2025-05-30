const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('NetworkOutage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ispId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ISPs',
        key: 'id'
      }
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endTime: {
      type: DataTypes.DATE
    },
    severity: {
      type: DataTypes.ENUM('minor', 'major', 'critical'),
      allowNull: false
    },
    affectedRegions: {
      type: DataTypes.ARRAY(DataTypes.STRING)
    },
    description: {
      type: DataTypes.TEXT
    },
    source: {
      type: DataTypes.ENUM('automated', 'manual', 'user_report'),
      defaultValue: 'automated'
    },
    impactScore: {
      type: DataTypes.FLOAT,
      validate: { min: 0, max: 100 }
    },
    isResolved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'network_outages',
    indexes: [
      { fields: ['startTime'] },
      { fields: ['severity'] },
      { fields: ['ispId'] }
    ]
  });
};