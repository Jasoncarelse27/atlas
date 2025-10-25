import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkSupabaseHealth, supabase } from '../lib/supabaseClient';

// Login Toggle Component
const LoginToggle = ({ mode, setMode }: { mode: 'login' | 'signup'; setMode: (mode: 'login' | 'signup') => void }) => (
  <div className="flex justify-center space-x-1 bg-[#F0E6DC] rounded-full p-1 mb-6">
    <button
      onClick={() => setMode('login')}
      className={`px-4 py-2 rounded-full font-medium transition-all duration-200 ${
        mode === 'login'
          ? 'bg-[#8FA67E] text-white shadow-sm'
          : 'text-[#8B7E74] hover:text-[#5A524A]'
      }`}
    >
      Login
    </button>
    <button
      onClick={() => setMode('signup')}
      className={`px-4 py-2 rounded-full font-medium transition-all duration-200 ${
        mode === 'signup'
          ? 'bg-[#8FA67E] text-white shadow-sm'
          : 'text-[#8B7E74] hover:text-[#5A524A]'
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
  const [healthError, setHealthError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Check Supabase health on component mount
  useEffect(() => {
    (async () => {
      const result = await checkSupabaseHealth();
      if (!result.ok) {
        setHealthError("⚠️ Cannot connect to Atlas servers. Please check your internet connection and try again.");
      }
    })();
  }, []);

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
          // Redirect to dashboard after successful login
          navigate('/chat');
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

  // Show health error if Supabase is unreachable
  if (healthError) {
    return (
      <div className="p-4 bg-[#CF9A96]/10 text-[#A67571] rounded-md text-center border border-[#CF9A96]/30">
        {healthError}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email Input */}
      <div className="flex items-center border border-[#E8DDD2] rounded-xl px-4 py-3 bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#8FA67E] focus-within:border-[#8FA67E] transition-all duration-200">
        <Mail className="w-5 h-5 text-[#8B7E74] mr-3" />
        <input
          type="email"
          placeholder="jasonc.jpg@gmail.com"
          className="w-full outline-none text-[#3B3632] placeholder-[#B8A9A0]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
      </div>

      {/* Password Input */}
      <div className="flex items-center border border-[#E8DDD2] rounded-xl px-4 py-3 bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#8FA67E] focus-within:border-[#8FA67E] transition-all duration-200">
        <Lock className="w-5 h-5 text-[#8B7E74] mr-3" />
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          className="w-full outline-none text-[#3B3632] placeholder-[#B8A9A0]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={togglePassword}
          className="ml-2 text-[#8B7E74] hover:text-[#5A524A] transition-colors"
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-[#A67571] text-sm text-center bg-[#CF9A96]/10 border border-[#CF9A96]/30 rounded-lg py-2">
          {error}
        </div>
      )}

      {/* Forgot Password - Right Aligned */}
      <div className="flex justify-end">
        <a href="#" className="text-sm text-[#8B7E74] hover:text-[#5A524A] hover:underline transition-colors">
          Forgot Password?
        </a>
      </div>

      {/* Login Button - Full Width, Green Background */}
      <button
        type="submit"
        className="w-full bg-[#8FA67E] hover:bg-[#7E9570] text-white py-3 rounded-xl font-semibold flex justify-center items-center transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
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
    <div className="min-h-screen bg-gradient-to-b from-[#F4E8E1] to-[#CEC1B8] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#F9F6F3] rounded-3xl shadow-lg p-6 space-y-6 border border-[#E8DDD2]">
        {/* Atlas Logo and Branding */}
        <div className="text-center">
          <img
            src="/atlas-logo.png"
            alt="Atlas AI Logo"
            className="mx-auto mb-4 h-16 w-16"
          />
          <h1 className="text-2xl font-bold text-[#3B3632]">Atlas</h1>
          <p className="text-sm text-[#8B7E74]">
            Your AI-Powered Emotional Intelligence Companion
          </p>
        </div>

        {/* Login/Signup Toggle */}
        <LoginToggle mode={mode} setMode={setMode} />

        {/* Auth Form */}
        <AuthForm mode={mode} />

        {/* Policy Text - Bottom, Centered */}
        <p className="text-center text-xs text-[#B8A9A0] mt-4">
          By continuing, you agree to our{' '}
          <a href="#" className="text-[#8B7E74] underline hover:text-[#5A524A] transition-colors">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-[#8B7E74] underline hover:text-[#5A524A] transition-colors">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;