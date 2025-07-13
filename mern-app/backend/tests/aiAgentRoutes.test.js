const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

describe('AI Agent Routes', () => {
  let token;
  let userId;

  // Set up authenticated user before tests
  beforeEach(async () => {
    // Create a test user
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    
    userId = user._id;
    token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret');
  });

  // Test chat with AI agent
  describe('POST /api/aiagent/chat', () => {
    it('should respond to chat messages when authenticated', async () => {
      const response = await request(app)
        .post('/api/aiagent/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Hello, I need help with my application'
        })
        .expect(200);

      expect(response.body).toHaveProperty('response');
      expect(typeof response.body.response).toBe('string');
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .post('/api/aiagent/chat')
        .send({
          message: 'Hello, I need help with my application'
        })
        .expect(401);
    });

    it('should return 400 when message is missing', async () => {
      const response = await request(app)
        .post('/api/aiagent/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  // Test document extraction
  describe('POST /api/aiagent/extract', () => {
    it('should extract information from uploaded document', async () => {
      // Create a test file with structured data
      const testFilePath = path.join(__dirname, 'test-document.txt');
      fs.writeFileSync(
        testFilePath, 
        'Name: John Doe\nDate of Birth: 01/01/1980\nAddress: 123 Test Street, Test City'
      );

      const response = await request(app)
        .post('/api/aiagent/extract')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', testFilePath)
        .expect(200);

      // Cleanup
      fs.unlinkSync(testFilePath);

      expect(response.body).toHaveProperty('extractedData');
      expect(response.body.extractedData).toHaveProperty('name');
      expect(response.body.extractedData).toHaveProperty('dateOfBirth');
      expect(response.body.extractedData).toHaveProperty('address');
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .post('/api/aiagent/extract')
        .expect(401);
    });

    it('should return 400 when no document is provided', async () => {
      const response = await request(app)
        .post('/api/aiagent/extract')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  // Test policy upload and indexing
  describe('POST /api/aiagent/policy/upload', () => {
    it('should upload and index policy document', async () => {
      // Create a test policy document
      const testFilePath = path.join(__dirname, 'test-policy.txt');
      fs.writeFileSync(
        testFilePath, 
        'This is a test policy document with specific guidelines and rules.'
      );

      const response = await request(app)
        .post('/api/aiagent/policy/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', testFilePath)
        .expect(200);

      // Cleanup
      fs.unlinkSync(testFilePath);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .post('/api/aiagent/policy/upload')
        .expect(401);
    });
  });

  // Test policy-based queries
  describe('POST /api/aiagent/policy/query', () => {
    it('should query against indexed policy documents', async () => {
      const response = await request(app)
        .post('/api/aiagent/policy/query')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: 'What are the eligibility requirements?'
        })
        .expect(200);

      expect(response.body).toHaveProperty('response');
      expect(typeof response.body.response).toBe('string');
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .post('/api/aiagent/policy/query')
        .send({
          query: 'What are the eligibility requirements?'
        })
        .expect(401);
    });

    it('should return 400 when query is missing', async () => {
      const response = await request(app)
        .post('/api/aiagent/policy/query')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});
