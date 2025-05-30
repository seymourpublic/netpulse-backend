const { sequelize } = require('../models');

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ Database schema synchronized');
    
    console.log('🎉 Migrations completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };