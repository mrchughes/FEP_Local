import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from './mocks/server';
import { rest } from 'msw';
import { BrowserRouter } from 'react-router-dom';
import ChatComponent from '../components/ChatComponent';

// Start the mock server before tests
beforeAll(() => server.listen());

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Close the server after tests
afterAll(() => server.close());

describe('ChatComponent', () => {
  // Mock localStorage.getItem to return a token
  beforeEach(() => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'userInfo') {
        return JSON.stringify({
          token: 'fake-jwt-token'
        });
      }
      return null;
    });
  });
  
  // Reset mocks after each test
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test('renders chat component with input field and send button', () => {
    render(
      <BrowserRouter>
        <ChatComponent />
      </BrowserRouter>
    );
    
    // Check if the chat elements are rendered
    expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });
  
  test('displays message in chat when user sends a message', async () => {
    render(
      <BrowserRouter>
        <ChatComponent />
      </BrowserRouter>
    );
    
    // Type a message
    const input = screen.getByPlaceholderText(/type your message/i);
    fireEvent.change(input, {
      target: { value: 'Hello, can you help me?' }
    });
    
    // Send the message
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    
    // Check if the user message is displayed in the chat
    expect(screen.getByText('Hello, can you help me?')).toBeInTheDocument();
    
    // Check if the AI response is displayed after the request
    await waitFor(() => {
      expect(screen.getByText('This is a mock response from the AI agent.')).toBeInTheDocument();
    });
  });
  
  test('shows error message when API request fails', async () => {
    // Override the mock handler to return an error
    server.use(
      rest.post('/api/aiagent/chat', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ message: 'Server error' })
        );
      })
    );
    
    render(
      <BrowserRouter>
        <ChatComponent />
      </BrowserRouter>
    );
    
    // Type a message
    const input = screen.getByPlaceholderText(/type your message/i);
    fireEvent.change(input, {
      target: { value: 'Hello' }
    });
    
    // Send the message
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
  
  test('does not send empty messages', () => {
    render(
      <BrowserRouter>
        <ChatComponent />
      </BrowserRouter>
    );
    
    // Try to send empty message
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    
    // No message should be in the chat
    expect(screen.queryByText(/user:/i)).not.toBeInTheDocument();
  });
});
