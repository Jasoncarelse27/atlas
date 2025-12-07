import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { checkSupabaseHealth, supabase } from '../lib/supabaseClient';
import { getApiEndpoint } from '../utils/apiClient';
import { fetchWithAuth } from '../utils/authFetch';
import { navigateToLastConversation } from '../utils/chatNavigation';

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
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
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

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    setShowForgotPassword(true);
    setError(null);
    setSuccess(null);
  };

  const handleSendResetEmail = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        // ✅ IMPROVED: Better error messages for common issues
        if (error.message.includes('rate limit') || error.message.includes('too many')) {
          throw new Error('Too many reset requests. Please wait a few minutes and try again.');
        } else if (error.message.includes('not found') || error.message.includes('user')) {
          // Don't reveal if email exists for security, but provide helpful message
          throw new Error('If an account exists with this email, a password reset link has been sent.');
        } else {
          throw error;
        }
      }

      // ✅ IMPROVED: Always show success message (Supabase doesn't reveal if email exists)
      // This prevents email enumeration attacks
      setSuccess('If an account exists with this email, a password reset link has been sent. Please check your inbox (and spam folder).');
      setShowForgotPassword(false);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
                marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null,
                age_verified: ageVerified,
                age_verified_at: ageVerified ? new Date().toISOString() : null
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
                  age_verified: ageVerified,
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

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-semibold text-[#3B3632] dark:text-white mb-2">
            Reset Password
          </h2>
          <p className="text-sm text-[#8B7E74] dark:text-gray-400">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {/* Email Input */}
        <div className="flex items-center border border-[#E8DDD2] dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-[#8FA67E] dark:focus-within:ring-gray-500 focus-within:border-[#8FA67E] dark:focus-within:border-gray-500 transition-all duration-200">
          <Mail className="w-5 h-5 text-[#8B7E74] dark:text-gray-400 mr-3" />
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full outline-none text-[#3B3632] dark:text-white placeholder-[#B8A9A0] dark:placeholder-gray-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-[#A67571] dark:text-red-400 text-sm text-center bg-[#CF9A96]/10 dark:bg-red-900/20 border border-[#CF9A96]/30 dark:border-red-800/30 rounded-lg py-2">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="text-[#8FA67E] dark:text-green-400 text-sm text-center bg-[#8FA67E]/10 dark:bg-green-900/20 border border-[#8FA67E]/30 dark:border-green-800/30 rounded-lg py-2">
            {success}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setShowForgotPassword(false);
              setError(null);
              setSuccess(null);
            }}
            className="flex-1 px-4 py-3 border border-[#E8DDD2] dark:border-gray-700 text-[#8B7E74] dark:text-gray-400 rounded-xl font-medium hover:bg-[#F0E6DC] dark:hover:bg-gray-800 transition-colors"
            disabled={loading}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSendResetEmail}
            className="flex-1 bg-[#8FA67E] dark:bg-gray-700 hover:bg-[#7E9570] dark:hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading || !email}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </div>
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
          placeholder="you@example.com"
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

      {/* Success Message */}
      {success && (
        <div className="text-[#8FA67E] dark:text-green-400 text-sm text-center bg-[#8FA67E]/10 dark:bg-green-900/20 border border-[#8FA67E]/30 dark:border-green-800/30 rounded-lg py-2">
          {success}
        </div>
      )}

      {/* Forgot Password - Right Aligned - Only show on login */}
      {mode === 'login' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm text-[#8B7E74] dark:text-gray-400 hover:text-[#5A524A] dark:hover:text-gray-300 hover:underline transition-colors"
          >
            Forgot Password?
          </button>
        </div>
      )}

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

        {/* Required: Age Verification - Only show on signup */}
        {mode === 'signup' && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ageVerified}
              onChange={(e) => setAgeVerified(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#E8DDD2] dark:border-gray-600 text-[#8FA67E] focus:ring-[#8FA67E] dark:focus:ring-gray-500"
              required={mode === 'signup'}
            />
            <span className="text-sm text-[#3B3632] dark:text-gray-300">
              I am 18 years or older
            </span>
          </label>
        )}
      </div>

      {/* Login Button - Full Width, Green Background */}
      <button
        type="submit"
        className="w-full bg-[#8FA67E] dark:bg-gray-700 hover:bg-[#7E9570] dark:hover:bg-gray-600 text-white py-3 rounded-xl font-semibold flex justify-center items-center transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={loading || !gdprAccepted || (mode === 'signup' && !ageVerified)}
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
  const [searchParams] = useSearchParams();
  const urlMode = searchParams.get('mode');
  const urlTier = searchParams.get('tier');
  
  // ✅ Read mode from URL, default to 'login'
  const [mode, setMode] = useState<'login' | 'signup'>(
    urlMode === 'signup' ? 'signup' : 'login'
  );
  
  // ✅ Update mode when URL changes
  useEffect(() => {
    if (urlMode === 'signup') {
      setMode('signup');
    } else if (urlMode === 'login') {
      setMode('login');
    }
  }, [urlMode]);
  
  // ✅ Store tier for analytics (optional - tracks which pricing button was clicked)
  useEffect(() => {
    if (urlTier && ['free', 'core', 'studio'].includes(urlTier)) {
      localStorage.setItem('atlas:signup_tier', urlTier);
    }
  }, [urlTier]);

  return (
    <div className="h-dvh bg-gradient-to-b from-[#F4E8E1] to-[#CEC1B8] dark:from-gray-900 dark:to-gray-800 flex items-start justify-center px-4 py-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-[#F9F6F3] dark:bg-gray-900 rounded-3xl shadow-lg p-6 space-y-6 border border-[#E8DDD2] dark:border-gray-700 my-auto">
        {/* Atlas Logo and Branding */}
        <div className="text-center">
          <img
            src="/atlas-logo.png"
            alt="Atlas Logo"
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