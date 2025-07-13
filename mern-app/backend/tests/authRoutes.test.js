const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

describe('Auth Routes', () => {
  // Test user data
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123'
  };

  // Test registration
  describe('POST /api/users/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send(testUser)
        .expect(201);

      // Check response structure
      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('token');
      expect(response.body.name).toBe(testUser.name);
      expect(response.body.email).toBe(testUser.email);

      // Verify user was created in the database
      const user = await User.findOne({ email: testUser.email });
      expect(user).not.toBeNull();
    });

    it('should not register a user with missing fields', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: 'Test User',
          email: 'test@example.com'
          // Missing password
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should not register a user with an existing email', async () => {
      // Create a user first
      await User.create(testUser);

      // Try to register with the same email
      const response = await request(app)
        .post('/api/users/register')
        .send(testUser)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  // Test login
  describe('POST /api/users/login', () => {
    beforeEach(async () => {
      // Create a test user before each test
      await User.create(testUser);
    });

    it('should login an existing user', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      // Check response structure
      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('token');
      expect(response.body.name).toBe(testUser.name);
      expect(response.body.email).toBe(testUser.email);

      // Verify token is valid
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET || 'secret');
      expect(decoded.id).toBe(response.body._id);
    });

    it('should not login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should not login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  // Test get user profile
  describe('GET /api/users/profile', () => {
    let token;

    beforeEach(async () => {
      // Create a test user and get token
      const user = await User.create(testUser);
      token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret');
    });

    it('should get user profile when authenticated', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe(testUser.name);
      expect(response.body.email).toBe(testUser.email);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .get('/api/users/profile')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401);
    });
  });
});
