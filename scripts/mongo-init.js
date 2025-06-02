db = db.getSiblingDB('netpulse');

// Create collections with validation
db.createCollection('speedtests', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["downloadSpeed", "uploadSpeed", "latency", "ipAddress"],
      properties: {
        downloadSpeed: { bsonType: "number", minimum: 0 },
        uploadSpeed: { bsonType: "number", minimum: 0 },
        latency: { bsonType: "number", minimum: 0 },
        packetLoss: { bsonType: "number", minimum: 0, maximum: 100 }
      }
    }
  }
});

db.createCollection('isps', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "country"],
      properties: {
        name: { bsonType: "string" },
        country: { bsonType: "string" }
      }
    }
  }
});

// Create indexes for better performance
db.speedtests.createIndex({ "createdAt": -1 });
db.speedtests.createIndex({ "ispId": 1 });
db.speedtests.createIndex({ "location.country": 1 });

db.isps.createIndex({ "name": 1 }, { unique: true });
db.isps.createIndex({ "statistics.reliabilityScore": -1 });

print("MongoDB initialization completed");
