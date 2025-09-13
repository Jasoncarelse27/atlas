import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Login Toggle Component
const LoginToggle = ({ mode, setMode }: { mode: 'login' | 'signup'; setMode: (mode: 'login' | 'signup') => void }) => (
  <div className="flex justify-center space-x-1 bg-gray-100 rounded-full p-1 mb-6">
    <button
      onClick={() => setMode('login')}
      className={`px-4 py-2 rounded-full font-medium transition-all duration-200 ${
        mode === 'login'
          ? 'bg-[#B2BDA3] text-white shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      Login
    </button>
    <button
      onClick={() => setMode('signup')}
      className={`px-4 py-2 rounded-full font-medium transition-all duration-200 ${
        mode === 'signup'
          ? 'bg-[#B2BDA3] text-white shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      Sign Up
    </button>
  </div>
);

// Auth Form Component
const AuthForm = ({ mode }: { mode: 'login' | 'signup' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const togglePassword = () => setShowPassword((prev) => !prev);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
        } else {
          console.log('Login successful');
          // Redirect to dashboard after successful login
          navigate('/dashboard');
        }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setError(error.message);
        } else {
          setError('Check your email for verification link');
        }
      }
    } catch (_err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email Input */}
      <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#B2BDA3] focus-within:border-[#B2BDA3] transition-all duration-200">
        <Mail className="w-5 h-5 text-gray-400 mr-3" />
        <input
          type="email"
          placeholder="jasonc.jpg@gmail.com"
          className="w-full outline-none text-gray-700 placeholder-gray-400"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
      </div>

      {/* Password Input */}
      <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#B2BDA3] focus-within:border-[#B2BDA3] transition-all duration-200">
        <Lock className="w-5 h-5 text-gray-400 mr-3" />
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          className="w-full outline-none text-gray-700 placeholder-gray-400"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={togglePassword}
          className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-lg py-2">
          {error}
        </div>
      )}

      {/* Forgot Password - Right Aligned */}
      <div className="flex justify-end">
        <a href="#" className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors">
          Forgot Password?
        </a>
      </div>

      {/* Login Button - Full Width, Green Background */}
      <button
        type="submit"
        className="w-full bg-[#B2BDA3] hover:bg-[#A0AD8F] text-white py-3 rounded-xl font-semibold flex justify-center items-center transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={loading}
      >
        {loading ? 'Signing In...' : (
          <>
            {mode === 'login' ? 'Login' : 'Sign Up'} <span className="ml-2">→</span>
          </>
        )}
      </button>
    </form>
  );
};

// Main Login Screen Component
const AuthPage = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F4E5D9] to-[#B2BDA3] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-6 space-y-6">
        {/* Atlas Logo and Branding */}
        <div className="text-center">
          <img
            src="/atlas-logo.png"
            alt="Atlas AI Logo"
            className="mx-auto mb-4 h-16 w-16"
          />
          <h1 className="text-2xl font-bold text-gray-800">Atlas</h1>
          <p className="text-sm text-gray-500">
            Your AI-Powered Emotional Intelligence Companion
          </p>
        </div>

        {/* Login/Signup Toggle */}
        <LoginToggle mode={mode} setMode={setMode} />

        {/* Auth Form */}
        <AuthForm mode={mode} />

        {/* Policy Text - Bottom, Centered */}
        <p className="text-center text-xs text-gray-400 mt-4">
          By continuing, you agree to our{' '}
          <a href="#" className="text-gray-500 underline hover:text-gray-700 transition-colors">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-gray-500 underline hover:text-gray-700 transition-colors">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;