import { Eye, EyeOff, Lock } from "lucide-react";
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeExchanged, setCodeExchanged] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // ✅ FIX: Supabase PKCE flow - exchange code for session
    const exchangeCodeForSession = async () => {
      const code = searchParams.get('code');
      const type = searchParams.get('type'); // Should be 'recovery' for password reset
      
      if (!code) {
        setError('Invalid or missing reset code. Please request a new password reset.');
        return;
      }

      // Type is optional - Supabase may not always include it
      // Only validate if present
      if (type && type !== 'recovery') {
        setError('Invalid reset link type. Please request a new password reset.');
        return;
      }

      try {
        // Exchange the authorization code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          // ✅ IMPROVED: Better error messages
          if (exchangeError.message.includes('expired') || exchangeError.message.includes('invalid')) {
            throw new Error('This reset link has expired or is invalid. Please request a new password reset.');
          } else if (exchangeError.message.includes('already been used')) {
            throw new Error('This reset link has already been used. Please request a new password reset.');
          }
          throw exchangeError;
        }

        if (!data.session) {
          throw new Error('Failed to establish session. The reset link may have expired.');
        }

        // ✅ VERIFY: Double-check session is valid before proceeding
        const { data: { session: verifiedSession }, error: verifyError } = await supabase.auth.getSession();
        
        if (verifyError || !verifiedSession) {
          throw new Error('Session verification failed. Please try again.');
        }

        // Code successfully exchanged, user now has a valid session
        setCodeExchanged(true);
        setError(null);
      } catch (err: unknown) {
        const error = err as Error;
        setError(error.message || 'Failed to verify reset link. Please request a new password reset.');
        setCodeExchanged(false);
      }
    };

    exchangeCodeForSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // ✅ FIX: Ensure code has been exchanged before allowing password update
    if (!codeExchanged) {
      setError('Please wait while we verify your reset link...');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      // ✅ VERIFY: Ensure we still have a valid session before updating password
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Auth session missing! Please request a new password reset link.');
      }

      // ✅ FIX: Now that we have a valid session from exchangeCodeForSession,
      // we can safely update the password
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        // ✅ IMPROVED: Better error messages
        if (error.message.includes('session')) {
          throw new Error('Your session expired. Please request a new password reset link.');
        }
        throw error;
      }

      setSuccess('Password reset successfully! Redirecting to login...');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-[#3B3632] dark:text-white">Reset Password</h1>
          <p className="text-sm text-[#8B7E74] dark:text-gray-400">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password Input */}
          <div className="flex items-center border border-[#E8DDD2] dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-[#8FA67E] dark:focus-within:ring-gray-500 focus-within:border-[#8FA67E] dark:focus-within:border-gray-500 transition-all duration-200">
            <Lock className="w-5 h-5 text-[#8B7E74] dark:text-gray-400 mr-3" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="New Password"
              className="w-full outline-none text-[#3B3632] dark:text-white placeholder-[#B8A9A0] dark:placeholder-gray-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="ml-2 text-[#8B7E74] dark:text-gray-400 hover:text-[#5A524A] dark:hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Confirm Password Input */}
          <div className="flex items-center border border-[#E8DDD2] dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-[#8FA67E] dark:focus-within:ring-gray-500 focus-within:border-[#8FA67E] dark:focus-within:border-gray-500 transition-all duration-200">
            <Lock className="w-5 h-5 text-[#8B7E74] dark:text-gray-400 mr-3" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm New Password"
              className="w-full outline-none text-[#3B3632] dark:text-white placeholder-[#B8A9A0] dark:placeholder-gray-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="ml-2 text-[#8B7E74] dark:text-gray-400 hover:text-[#5A524A] dark:hover:text-gray-300 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-[#8FA67E] dark:bg-gray-700 hover:bg-[#7E9570] dark:hover:bg-gray-600 text-white py-3 rounded-xl font-semibold flex justify-center items-center transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading || !password || !confirmPassword || !codeExchanged}
          >
            {loading ? 'Resetting Password...' : !codeExchanged ? 'Verifying Reset Link...' : 'Reset Password'}
          </button>
        </form>

        {/* Back to Login Link */}
        <div className="text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-[#8B7E74] dark:text-gray-400 hover:text-[#5A524A] dark:hover:text-gray-300 hover:underline transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

