const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'netpulse',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const SpeedTest = require('./speedTest')(sequelize);
const ISP = require('./isp')(sequelize);
const NetworkOutage = require('./networkOutage')(sequelize);
const UserSession = require('./userSession')(sequelize);
const ServerNode = require('./serverNode')(sequelize);

// Define associations
SpeedTest.belongsTo(ISP, { foreignKey: 'ispId' });
ISP.hasMany(SpeedTest, { foreignKey: 'ispId' });

SpeedTest.belongsTo(UserSession, { foreignKey: 'sessionId' });
UserSession.hasMany(SpeedTest, { foreignKey: 'sessionId' });

SpeedTest.belongsTo(ServerNode, { foreignKey: 'serverNodeId' });
ServerNode.hasMany(SpeedTest, { foreignKey: 'serverNodeId' });

NetworkOutage.belongsTo(ISP, { foreignKey: 'ispId' });
ISP.hasMany(NetworkOutage, { foreignKey: 'ispId' });

module.exports = {
  sequelize,
  SpeedTest,
  ISP,
  NetworkOutage,
  UserSession,
  ServerNode
};
