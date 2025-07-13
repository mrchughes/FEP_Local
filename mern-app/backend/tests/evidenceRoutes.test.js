const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

describe('Evidence Routes', () => {
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

  // Test evidence upload
  describe('POST /api/evidence/upload', () => {
    it('should upload evidence document', async () => {
      // Create a test file
      const testFilePath = path.join(__dirname, 'test-evidence.txt');
      fs.writeFileSync(testFilePath, 'This is a test evidence document');

      const response = await request(app)
        .post('/api/evidence/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', testFilePath)
        .expect(200);

      // Cleanup
      fs.unlinkSync(testFilePath);

      expect(response.body).toHaveProperty('filename');
      expect(response.body).toHaveProperty('path');
      expect(response.body).toHaveProperty('userId');
      expect(response.body.userId).toBe(userId.toString());
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .post('/api/evidence/upload')
        .expect(401);
    });

    it('should return 400 when no file is provided', async () => {
      const response = await request(app)
        .post('/api/evidence/upload')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  // Test get user evidence
  describe('GET /api/evidence', () => {
    it('should get all evidence for authenticated user', async () => {
      // First upload a test evidence document
      const testFilePath = path.join(__dirname, 'test-evidence.txt');
      fs.writeFileSync(testFilePath, 'This is a test evidence document');

      await request(app)
        .post('/api/evidence/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', testFilePath);

      // Cleanup
      fs.unlinkSync(testFilePath);

      // Now get the evidence
      const response = await request(app)
        .get('/api/evidence')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('filename');
      expect(response.body[0]).toHaveProperty('userId');
      expect(response.body[0].userId).toBe(userId.toString());
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .get('/api/evidence')
        .expect(401);
    });
  });

  // Test delete evidence
  describe('DELETE /api/evidence/:id', () => {
    it('should delete evidence document', async () => {
      // First upload a test evidence document
      const testFilePath = path.join(__dirname, 'test-evidence.txt');
      fs.writeFileSync(testFilePath, 'This is a test evidence document');

      const uploadResponse = await request(app)
        .post('/api/evidence/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', testFilePath);

      // Cleanup
      fs.unlinkSync(testFilePath);

      const evidenceId = uploadResponse.body._id;

      // Now delete the evidence
      const deleteResponse = await request(app)
        .delete(`/api/evidence/${evidenceId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(deleteResponse.body).toHaveProperty('message');
      expect(deleteResponse.body.message).toBe('Evidence deleted');

      // Verify it's deleted
      const getResponse = await request(app)
        .get('/api/evidence')
        .set('Authorization', `Bearer ${token}`);

      const found = getResponse.body.some(evidence => evidence._id === evidenceId);
      expect(found).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .delete('/api/evidence/123')
        .expect(401);
    });

    it('should return 404 when evidence not found', async () => {
      await request(app)
        .delete('/api/evidence/60a5c6c72e35f62b4c1f9999') // Non-existent ID
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
