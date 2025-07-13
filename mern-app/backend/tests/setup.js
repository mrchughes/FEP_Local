const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Setup before tests
beforeAll(async () => {
  // Create an in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Connect to the in-memory database
  await mongoose.connect(uri);
});

// Cleanup after tests
afterAll(async () => {
  // Disconnect from the database
  await mongoose.disconnect();
  
  // Stop the MongoDB server
  await mongoServer.stop();
});

// Reset the database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Set timeout for tests
jest.setTimeout(30000);
