import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock handlers for API requests
const handlers = [
  // Auth API handlers
  http.post('/api/users/login', async ({ request }) => {
    const { email, password } = await request.json();
    
    if (email === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        _id: '1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'fake-jwt-token'
      });
    }
    
    return new HttpResponse(
      JSON.stringify({ message: 'Invalid credentials' }),
      { status: 401 }
    );
  }),
  
  http.post('/api/users/register', async ({ request }) => {
    const data = await request.json();
    
    if (!data.name || !data.email || !data.password) {
      return new HttpResponse(
        JSON.stringify({ message: 'Please fill all fields' }),
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      _id: '1',
      name: data.name,
      email: data.email,
      token: 'fake-jwt-token'
    }, { status: 201 });
  }),
  
  http.get('/api/users/profile', ({ request }) => {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new HttpResponse(
        JSON.stringify({ message: 'Not authorized' }),
        { status: 401 }
      );
    }
    
    return HttpResponse.json({
      _id: '1',
      name: 'Test User',
      email: 'test@example.com'
    });
  }),
  
  // Evidence API handlers
  http.get('/api/evidence', ({ request }) => {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new HttpResponse(
        JSON.stringify({ message: 'Not authorized' }),
        { status: 401 }
      );
    }
    
    return HttpResponse.json([
      {
        _id: '1',
        filename: 'test-document.pdf',
        path: '/uploads/evidence/test-document.pdf',
        userId: '1',
        createdAt: new Date().toISOString()
      }
    ]);
  }),
  
  // AI Agent API handlers
  http.post('/api/aiagent/chat', async ({ request }) => {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new HttpResponse(
        JSON.stringify({ message: 'Not authorized' }),
        { status: 401 }
      );
    }
    
    const { message } = await request.json();
    
    if (!message) {
      return new HttpResponse(
        JSON.stringify({ message: 'Message is required' }),
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      response: 'This is a mock response from the AI agent.'
    });
  }),
  
  // Form API handlers
  http.get('/api/forms', ({ request }) => {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new HttpResponse(
        JSON.stringify({ message: 'Not authorized' }),
        { status: 401 }
      );
    }
    
    return HttpResponse.json([
      {
        _id: '1',
        title: 'Test Form',
        status: 'in-progress',
        userId: '1',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }
    ]);
  })
];

// Setup MSW server with the handlers
export const server = setupServer(...handlers);
