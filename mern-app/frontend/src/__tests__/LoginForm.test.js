import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

// Mock the useNavigate hook
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

describe('LoginForm Component', () => {
  test('renders login form with email and password inputs', () => {
    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );
    
    // Check if the form elements are rendered
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });
  
  test('shows validation errors when form is submitted with empty fields', async () => {
    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );
    
    // Submit the form without filling any fields
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    // Check if validation errors are displayed
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });
  
  test('calls the login API when form is submitted with valid data', async () => {
    // Mock the fetch function
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        _id: '1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'fake-jwt-token'
      })
    });
    
    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    // Check if the login API was called with correct data
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123'
          })
        })
      );
    });
  });
  
  test('displays error message when login fails', async () => {
    // Mock the fetch function to return an error
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        message: 'Invalid credentials'
      })
    });
    
    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
