import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from "react";
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import AuthPage from '../../../pages/AuthPage';

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => {
  const mockSupabase = {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn()
    }
  };
  
  return {
    supabase: mockSupabase,
    default: mockSupabase, // Add default export for dynamic imports
    checkSupabaseHealth: vi.fn(() => Promise.resolve({ ok: true }))
  };
});

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Wrapper component to provide router context
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Mode', () => {
    it('renders login form without crashing', () => {
      renderWithRouter(<AuthPage />);
      
      expect(screen.getByPlaceholderText('jasonc.jpg@gmail.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login →/i })).toBeInTheDocument();
    });

    it('shows password when toggle button is clicked', () => {
      renderWithRouter(<AuthPage />);
      
      const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button
      
      expect(passwordInput.type).toBe('password');
      
      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');
      
      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });

    it('submits form with correct data', async () => {
      const supabase = (await import('../../../lib/supabaseClient')).default;
      const mockSignIn = vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: { id: '123' }, session: {} },
        error: null
      });

      renderWithRouter(<AuthPage />);
      
      const emailInput = screen.getByPlaceholderText('jasonc.jpg@gmail.com');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByRole('button', { name: /login →/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
      
      expect(mockNavigate).toHaveBeenCalledWith('/chat');
    });

    it('shows error message on login failure', async () => {
      const supabase = (await import('../../../lib/supabaseClient')).default;
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' }
      });

      renderWithRouter(<AuthPage />);
      
      const emailInput = screen.getByPlaceholderText('jasonc.jpg@gmail.com');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByRole('button', { name: /login →/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });
  });

  describe('Signup Mode', () => {
    it('renders signup form when signup tab is clicked', () => {
      renderWithRouter(<AuthPage />);
      
      const signupTab = screen.getByText('Sign Up').closest('button');
      fireEvent.click(signupTab!);
      
      expect(screen.getByRole('button', { name: /sign up →/i })).toBeInTheDocument();
    });

    it('shows success message on signup', async () => {
      const supabase = (await import('../../../lib/supabaseClient')).default;
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: { id: '123' }, session: null },
        error: null
      });

      renderWithRouter(<AuthPage />);
      
      // Switch to signup mode
      const signupTab = screen.getByText('Sign Up').closest('button');
      fireEvent.click(signupTab!);
      
      const emailInput = screen.getByPlaceholderText('jasonc.jpg@gmail.com');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByRole('button', { name: /sign up →/i });
      
      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Check your email for verification link')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('requires email and password fields', () => {
      renderWithRouter(<AuthPage />);
      
      const emailInput = screen.getByPlaceholderText('jasonc.jpg@gmail.com');
      const passwordInput = screen.getByPlaceholderText('Password');
      
      expect(emailInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('required');
    });

    it('disables submit button while loading', async () => {
      const supabase = (await import('../../../lib/supabaseClient')).default;
      vi.mocked(supabase.auth.signInWithPassword).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderWithRouter(<AuthPage />);
      
      const emailInput = screen.getByPlaceholderText('jasonc.jpg@gmail.com');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByRole('button', { name: /login →/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);
      
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Signing In...')).toBeInTheDocument();
    });
  });

  describe('UI Elements', () => {
    it('displays Atlas logo', () => {
      renderWithRouter(<AuthPage />);
      
      const logo = screen.getByAltText('Atlas AI Logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/atlas-logo.png');
    });

    it('displays correct branding', () => {
      renderWithRouter(<AuthPage />);
      
      expect(screen.getByText('Atlas')).toBeInTheDocument();
      expect(screen.getByText('Your AI-Powered Emotional Intelligence Companion')).toBeInTheDocument();
    });

             it('displays login/signup toggle', () => {
           renderWithRouter(<AuthPage />);

           // Check that both toggle buttons exist in the toggle section
           const toggleButtons = screen.getAllByText(/^(Login|Sign Up)$/);
           expect(toggleButtons).toHaveLength(3); // 2 toggle buttons + 1 submit button

           // Check that the form submit button shows the current mode (login by default)
           expect(screen.getByRole('button', { name: /login →/i })).toBeInTheDocument();
         });

    it('displays forgot password link', () => {
      renderWithRouter(<AuthPage />);
      
      expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
    });

    it('displays terms and privacy policy', () => {
      renderWithRouter(<AuthPage />);
      
      expect(screen.getByText(/Terms of Service/)).toBeInTheDocument();
      expect(screen.getByText(/Privacy Policy/)).toBeInTheDocument();
    });
  });
});
