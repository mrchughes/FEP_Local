import { rest } from 'msw';
import { server } from './mocks/server';
import { loginUser, registerUser, getUserProfile } from '../api';

// Start the mock server before tests
beforeAll(() => server.listen());

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Close the server after tests
afterAll(() => server.close());

describe('API Functions', () => {
  // Test loginUser function
  describe('loginUser', () => {
    test('returns user data when login is successful', async () => {
      const userData = await loginUser('test@example.com', 'password123');
      
      expect(userData).toEqual({
        _id: '1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'fake-jwt-token'
      });
    });
    
    test('throws error when login fails', async () => {
      // Override the handler to simulate failed login
      server.use(
        rest.post('/api/users/login', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ message: 'Invalid credentials' })
          );
        })
      );
      
      await expect(loginUser('wrong@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });
  });
  
  // Test registerUser function
  describe('registerUser', () => {
    test('returns user data when registration is successful', async () => {
      const newUser = {
        name: 'New User',
        email: 'new@example.com',
        password: 'password123'
      };
      
      const userData = await registerUser(newUser);
      
      expect(userData).toEqual({
        _id: '1',
        name: newUser.name,
        email: newUser.email,
        token: 'fake-jwt-token'
      });
    });
    
    test('throws error when registration fails', async () => {
      // Override the handler to simulate failed registration
      server.use(
        rest.post('/api/users/register', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({ message: 'User already exists' })
          );
        })
      );
      
      const existingUser = {
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'password123'
      };
      
      await expect(registerUser(existingUser))
        .rejects.toThrow('User already exists');
    });
  });
  
  // Test getUserProfile function
  describe('getUserProfile', () => {
    test('returns user profile when token is valid', async () => {
      const profile = await getUserProfile('fake-jwt-token');
      
      expect(profile).toEqual({
        _id: '1',
        name: 'Test User',
        email: 'test@example.com'
      });
    });
    
    test('throws error when token is invalid', async () => {
      // Override the handler to simulate unauthorized access
      server.use(
        rest.get('/api/users/profile', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ message: 'Not authorized, token failed' })
          );
        })
      );
      
      await expect(getUserProfile('invalid-token'))
        .rejects.toThrow('Not authorized, token failed');
    });
  });
});
