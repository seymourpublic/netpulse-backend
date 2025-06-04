const mongoose = require('mongoose');
require('dotenv').config();

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxAttempts = 5;
  }

  async connect() {
    if (this.isConnected) {
      console.log('📡 Already connected to MongoDB');
      return;
    }

    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/netpulse';
    
    console.log('🔗 Connecting to MongoDB...');
    console.log(`📍 URI: ${mongoURI.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in logs
    
    try {
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        bufferMaxEntries: 0, // Disable mongoose buffering
        bufferCommands: false, // Disable mongoose buffering
      };

      await mongoose.connect(mongoURI, options);
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      console.log('✅ MongoDB connected successfully');
      console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
      console.log(`🏠 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
      
      // Set up connection event listeners
      this.setupEventListeners();
      
    } catch (error) {
      this.connectionAttempts++;
      console.error(`❌ MongoDB connection failed (attempt ${this.connectionAttempts}/${this.maxAttempts}):`, error.message);
      
      if (this.connectionAttempts < this.maxAttempts) {
        console.log(`⏳ Retrying in 5 seconds...`);
        setTimeout(() => this.connect(), 5000);
      } else {
        console.error('💥 Max connection attempts reached. Please check your MongoDB configuration.');
        throw error;
      }
    }
  }

  setupEventListeners() {
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err);
    });
  }

  async disconnect() {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('👋 MongoDB disconnected');
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      status: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
    };
  }
}

const dbConnection = new DatabaseConnection();

module.exports = dbConnection;