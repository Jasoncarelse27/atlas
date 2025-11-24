import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { navigateToLastConversation } from '../utils/chatNavigation';
import { checkSupabaseHealth, supabase } from '../lib/supabaseClient';
import { getApiEndpoint } from '../utils/apiClient';
import { fetchWithAuth } from '../utils/authFetch';

// Login Toggle Component
const LoginToggle = ({ mode, setMode }: { mode: 'login' | 'signup'; setMode: (mode: 'login' | 'signup') => void }) => (
  <div className="flex justify-center space-x-1 bg-[#F0E6DC] dark:bg-gray-800 rounded-full p-1 mb-6">
    <button
      onClick={() => setMode('login')}
      className={`px-4 py-2 rounded-full font-medium transition-all duration-200 ${
        mode === 'login'
          ? 'bg-[#8FA67E] dark:bg-gray-700 text-white shadow-sm'
          : 'text-[#8B7E74] dark:text-gray-400 hover:text-[#5A524A] dark:hover:text-gray-300'
      }`}
    >
      Login
    </button>
    <button
      onClick={() => setMode('signup')}
      className={`px-4 py-2 rounded-full font-medium transition-all duration-200 ${
        mode === 'signup'
          ? 'bg-[#8FA67E] dark:bg-gray-700 text-white shadow-sm'
          : 'text-[#8B7E74] dark:text-gray-400 hover:text-[#5A524A] dark:hover:text-gray-300'
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
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
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
          // Update GDPR consent in profiles table
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            // ✅ FIX: Use upsert to handle case where profile doesn't exist yet
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                id: user.id,
                email: user.email,
                gdpr_accepted: gdprAccepted,
                gdpr_accepted_at: new Date().toISOString(),
                marketing_opt_in: marketingOptIn,
                marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null
              }, {
                onConflict: 'id'
              });
            
            if (profileError) {
              // ✅ FIX: Non-blocking error - don't prevent login if GDPR update fails
              // This can happen if migration hasn't been applied or RLS policy blocks it
              console.error('Failed to update GDPR consent (non-blocking):', profileError);
            }
          }
          
          // Redirect to last conversation after successful login
          navigateToLastConversation(navigate);
        }
      } else {
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (error) {
          setError(error.message);
        } else {
          setError('Check your email for verification link');
          
          // Store GDPR consent for new signup
          if (data?.user?.id) {
            // Update GDPR consent in profiles table
            // ✅ FIX: Use upsert to handle case where profile doesn't exist yet
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                id: data.user.id,
                email: data.user.email,
                gdpr_accepted: gdprAccepted,
                gdpr_accepted_at: new Date().toISOString(),
                marketing_opt_in: marketingOptIn,
                marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null
              }, {
                onConflict: 'id'
              });
            
            if (profileError) {
              // ✅ FIX: Non-blocking error - don't prevent signup if GDPR update fails
              // This can happen if migration hasn't been applied or RLS policy blocks it
              console.error('Failed to store GDPR consent (non-blocking):', profileError);
            }
            
            // ✅ Send welcome notification (non-blocking - fire and forget)
            const welcomeEndpoint = getApiEndpoint('/api/magicbell/welcome');
            fetchWithAuth(welcomeEndpoint, {
              method: 'POST',
              preventRedirect: true, // Don't redirect on 401 (user just signed up)
              showErrorToast: false, // Silent failure - don't show errors
            }).catch(() => {
              // Silent catch - welcome notification failure shouldn't affect signup
            });

            // ✅ Sync to MailerLite for welcome email (non-blocking - fire and forget)
            // Note: We can't use the regular mailerLiteService here because the user doesn't have a session yet
            // Instead, we'll trigger the backend sync endpoint which will process the signup queue
            try {
              // Option 1: Direct API call to trigger MailerLite sync
              const syncEndpoint = getApiEndpoint('/api/mailerlite/signup-sync');
              fetch(syncEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: data.user.id,
                  email: data.user.email,
                  tier: 'free',
                  gdpr_accepted: gdprAccepted,
                  marketing_opt_in: marketingOptIn,
                }),
              }).catch(() => {
                // Silent catch - this is fire-and-forget
              });
              
              // Option 2: Also try the client-side service (in case session is available)
              import('../services/mailerLiteService').then(({ mailerLiteService }) => {
                mailerLiteService.createOrUpdateSubscriber({
                  email: data.user.email!,
                  tier: 'free',
                  signup_date: new Date().toISOString(),
                  subscription_status: 'active',
                  custom_fields: {
                    gdpr_accepted: gdprAccepted,
                    marketing_opt_in: marketingOptIn,
                  }
                }).then(() => {
                  // Add to free users group to trigger welcome email automation
                  return mailerLiteService.segmentSubscriber(data.user.email!, 'atlas_free_users');
                }).catch(() => {
                  // Silent catch - fallback attempt
                });
              });
            } catch (mailerError) {
              // Silent catch - MailerLite sync failure shouldn't affect signup
              console.log('[AuthPage] MailerLite sync failed (non-blocking):', mailerError);
            }
          }
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
      <div className="p-4 bg-[#CF9A96]/10 dark:bg-red-900/20 text-[#A67571] dark:text-red-400 rounded-md text-center border border-[#CF9A96]/30 dark:border-red-800/30">
        {healthError}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email Input */}
      <div className="flex items-center border border-[#E8DDD2] dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-[#8FA67E] dark:focus-within:ring-gray-500 focus-within:border-[#8FA67E] dark:focus-within:border-gray-500 transition-all duration-200">
        <Mail className="w-5 h-5 text-[#8B7E74] dark:text-gray-400 mr-3" />
        <input
          type="email"
          placeholder="jasonc.jpg@gmail.com"
          className="w-full outline-none text-[#3B3632] dark:text-white placeholder-[#B8A9A0] dark:placeholder-gray-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
      </div>

      {/* Password Input */}
      <div className="flex items-center border border-[#E8DDD2] dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-[#8FA67E] dark:focus-within:ring-gray-500 focus-within:border-[#8FA67E] dark:focus-within:border-gray-500 transition-all duration-200">
        <Lock className="w-5 h-5 text-[#8B7E74] dark:text-gray-400 mr-3" />
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          className="w-full outline-none text-[#3B3632] dark:text-white placeholder-[#B8A9A0] dark:placeholder-gray-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={togglePassword}
          className="ml-2 text-[#8B7E74] dark:text-gray-400 hover:text-[#5A524A] dark:hover:text-gray-300 transition-colors"
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-[#A67571] dark:text-red-400 text-sm text-center bg-[#CF9A96]/10 dark:bg-red-900/20 border border-[#CF9A96]/30 dark:border-red-800/30 rounded-lg py-2">
          {error}
        </div>
      )}

      {/* Forgot Password - Right Aligned */}
      <div className="flex justify-end">
        <a href="#" className="text-sm text-[#8B7E74] dark:text-gray-400 hover:text-[#5A524A] dark:hover:text-gray-300 hover:underline transition-colors">
          Forgot Password?
        </a>
      </div>

      {/* GDPR Compliance Checkboxes */}
      <div className="space-y-3 py-2">
        {/* Required: Terms and Privacy */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={gdprAccepted}
            onChange={(e) => setGdprAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#E8DDD2] dark:border-gray-600 text-[#8FA67E] focus:ring-[#8FA67E] dark:focus:ring-gray-500"
            required
          />
          <span className="text-sm text-[#3B3632] dark:text-gray-300">
            I agree to the{' '}
            <Link to="/terms" className="text-[#8B7E74] dark:text-gray-400 underline hover:text-[#5A524A] dark:hover:text-gray-300 transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-[#8B7E74] dark:text-gray-400 underline hover:text-[#5A524A] dark:hover:text-gray-300 transition-colors">
              Privacy Policy
            </Link>
          </span>
        </label>

        {/* Optional: Marketing emails */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#E8DDD2] dark:border-gray-600 text-[#8FA67E] focus:ring-[#8FA67E] dark:focus:ring-gray-500"
          />
          <span className="text-sm text-[#3B3632] dark:text-gray-300">
            I would like to receive product updates and tips via email
          </span>
        </label>
      </div>

      {/* Login Button - Full Width, Green Background */}
      <button
        type="submit"
        className="w-full bg-[#8FA67E] dark:bg-gray-700 hover:bg-[#7E9570] dark:hover:bg-gray-600 text-white py-3 rounded-xl font-semibold flex justify-center items-center transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={loading || !gdprAccepted}
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
    <div className="min-h-screen bg-gradient-to-b from-[#F4E8E1] to-[#CEC1B8] dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#F9F6F3] dark:bg-gray-900 rounded-3xl shadow-lg p-6 space-y-6 border border-[#E8DDD2] dark:border-gray-700">
        {/* Atlas Logo and Branding */}
        <div className="text-center">
          <img
            src="/atlas-logo.png"
            alt="Atlas AI Logo"
            className="mx-auto mb-4 h-16 w-16"
          />
          <h1 className="text-2xl font-bold text-[#3B3632] dark:text-white">Atlas</h1>
          <p className="text-sm text-[#8B7E74] dark:text-gray-400">
            Emotionally intelligent productivity assistant
          </p>
        </div>

        {/* Login/Signup Toggle */}
        <LoginToggle mode={mode} setMode={setMode} />

        {/* Auth Form */}
        <AuthForm mode={mode} />

        {/* Policy Text - Bottom, Centered */}
        <p className="text-center text-xs text-[#B8A9A0] dark:text-gray-500 mt-4">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="text-[#8B7E74] dark:text-gray-400 underline hover:text-[#5A524A] dark:hover:text-gray-300 transition-colors">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-[#8B7E74] dark:text-gray-400 underline hover:text-[#5A524A] dark:hover:text-gray-300 transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;