import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { supabase, isOfflineMode, getConnectionStatus } from '../lib/supabase';
import Background from '../components/Background';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import Tooltip from '../components/Tooltip';

interface AuthPageProps {
  onAuthSuccess?: () => void;
  themeMode?: 'light' | 'dark' | 'auto';
  onThemeChange?: (mode: 'light' | 'dark' | 'auto') => void;
  onBypassAuth?: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ 
  onAuthSuccess, 
  themeMode = 'dark', 
  onThemeChange,
  onBypassAuth
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState(getConnectionStatus());

  // Check connection status on mount
  useEffect(() => {
    const status = getConnectionStatus();
    setConnectionStatus(status);
    
    if (status.isOffline) {
      console.log('🔄 Auth page loaded in offline mode');
    }
  }, []);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Check if we're in offline mode first
    if (isOfflineMode) {
      setError('Authentication is not available in offline mode. This is expected when running in a WebContainer environment due to network restrictions.');
      return;
    }

    // Validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        console.log('🔐 Attempting to sign up with email:', email);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });

        if (error) throw error;

        if (data.user && !data.user.email_confirmed_at) {
          setSuccess('Please check your email and click the confirmation link to complete your registration.');
        } else {
          setSuccess('Account created successfully! You are now logged in.');
          onAuthSuccess?.();
        }
      } else {
        console.log('🔐 Attempting to sign in with email:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        console.log('✅ Sign in successful:', data.user?.email);
        setSuccess('Successfully signed in!');
        onAuthSuccess?.();
      }
    } catch (error: any) {
      console.error('❌ Auth error:', error);
      
      // Handle offline mode errors specifically
      if (error.message && error.message.includes('offline mode')) {
        setError('Authentication is not available in offline mode. This is expected when running in a WebContainer environment due to network restrictions.');
        return;
      }
      
      // Handle specific error messages
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Please check your email and click the confirmation link before signing in.');
      } else if (error.message.includes('User already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (error.message.includes('Password should be at least 6 characters')) {
        setError('Password must be at least 6 characters long.');
      } else {
        setError(error.message || 'An error occurred during authentication');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setSuccess(null);

    // Check if we're in offline mode first
    if (isOfflineMode) {
      setError('Google authentication is not available in offline mode. This is expected when running in a WebContainer environment due to network restrictions.');
      return;
    }

    setIsGoogleLoading(true);

    try {
      console.log('🔐 Attempting Google OAuth sign in...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) throw error;

      console.log('✅ Google OAuth initiated:', data);
      // The redirect will happen automatically, so we don't need to do anything else here
    } catch (error: any) {
      console.error('❌ Google OAuth error:', error);
      
      // Handle offline mode errors specifically
      if (error.message && error.message.includes('offline mode')) {
        setError('Google authentication is not available in offline mode. This is expected when running in a WebContainer environment due to network restrictions.');
      } else {
        setError(error.message || 'Failed to sign in with Google');
      }
      setIsGoogleLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirmPassword('');
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, label: '', color: '' };
    if (password.length < 6) return { strength: 1, label: 'Too short', color: 'text-red-400' };
    if (password.length < 8) return { strength: 2, label: 'Weak', color: 'text-orange-400' };
    if (password.length < 12) return { strength: 3, label: 'Good', color: 'text-yellow-400' };
    return { strength: 4, label: 'Strong', color: 'text-green-400' };
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="min-h-screen text-white relative overflow-hidden flex flex-col">
      <Background />
      
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center z-20">
        <div className="w-10"></div> {/* Spacer for centering */}
        <Logo className="mx-auto" />
        <div className="flex items-center gap-2">
          {onThemeChange && (
            <ThemeToggle
              themeMode={themeMode}
              onThemeChange={onThemeChange}
              variant="icon"
            />
          )}
          {onBypassAuth && import.meta.env.DEV && (
            <button
              onClick={onBypassAuth}
              className="p-2 rounded-full bg-green-600/80 text-white hover:bg-green-700/90 transition-colors text-xs"
            >
              Skip
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-16 sm:py-20 px-4 z-10">
        <div className="w-full max-w-md">
          {/* Auth Card */}
          <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900/70 backdrop-blur-md rounded-2xl border border-indigo-700/40 p-6 sm:p-8 shadow-2xl">
            {/* Connection Status Indicator */}
            {connectionStatus.isOffline && (
              <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <WifiOff className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-orange-200 text-sm font-medium mb-1">Offline Mode</p>
                    <p className="text-orange-300/80 text-xs leading-relaxed">
                      Authentication features are limited in the WebContainer environment. 
                      For full functionality, please run this application in a standard browser environment.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Title */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 mb-2">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </h1>
              <p className="text-indigo-300/80 text-sm">
                {isSignUp 
                  ? 'Join Atlas and start your intelligent conversations' 
                  : 'Sign in to continue your Atlas experience'
                }
              </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <ErrorMessage
                message={error}
                type="error"
                dismissible
                onDismiss={() => setError(null)}
                className="mb-6"
              />
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-green-200 text-sm leading-relaxed">{success}</p>
                </div>
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleAuth}
              disabled={isLoading || isGoogleLoading || isOfflineMode}
              className="w-full mb-6 px-5 py-3 bg-white hover:bg-gray-50 text-gray-900 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3 transform hover:scale-105 disabled:hover:scale-100 disabled:opacity-50 shadow-lg"
            >
              {isGoogleLoading ? (
                <LoadingSpinner size="sm" color="gray" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-indigo-700/30"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gradient-to-br from-indigo-950/80 to-slate-900/70 text-indigo-300/80">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4 sm:space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-indigo-300 mb-1 sm:mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 sm:py-3 bg-indigo-900/40 border border-indigo-700/30 rounded-xl text-white placeholder-indigo-400/70 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all duration-200 text-sm sm:text-base"
                    placeholder="Enter your email"
                    disabled={isLoading || isGoogleLoading || isOfflineMode}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-indigo-300 mb-1 sm:mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 sm:py-3 bg-indigo-900/40 border border-indigo-700/30 rounded-xl text-white placeholder-indigo-400/70 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all duration-200 text-sm sm:text-base"
                    placeholder="Enter your password"
                    disabled={isLoading || isGoogleLoading || isOfflineMode}
                    required
                    minLength={6}
                  />
                  <Tooltip content={showPassword ? "Hide password" : "Show password"} position="left">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-indigo-400 hover:text-yellow-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                    </button>
                  </Tooltip>
                </div>
                
                {/* Password Strength Indicator */}
                {isSignUp && password && (
                  <div className="mt-2 space-y-1 sm:space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-indigo-400">Password strength:</span>
                      <span className={passwordStrength.color}>{passwordStrength.label}</span>
                    </div>
                    <div className="w-full bg-indigo-900/30 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          passwordStrength.strength === 1 ? 'bg-red-400 w-1/4' :
                          passwordStrength.strength === 2 ? 'bg-orange-400 w-2/4' :
                          passwordStrength.strength === 3 ? 'bg-yellow-400 w-3/4' :
                          passwordStrength.strength === 4 ? 'bg-green-400 w-full' : 'w-0'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field (Sign Up Only) */}
              {isSignUp && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-indigo-300 mb-1 sm:mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 sm:py-3 bg-indigo-900/40 border border-indigo-700/30 rounded-xl text-white placeholder-indigo-400/70 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all duration-200 text-sm sm:text-base"
                      placeholder="Confirm your password"
                      disabled={isLoading || isGoogleLoading || isOfflineMode}
                      required
                    />
                    <Tooltip content={showConfirmPassword ? "Hide password" : "Show password"} position="left">
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-indigo-400 hover:text-yellow-400 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </button>
                    </Tooltip>
                  </div>
                  
                  {/* Password Match Indicator */}
                  {confirmPassword && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      {password === confirmPassword ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          <span className="text-red-400">Passwords do not match</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading || isOfflineMode}
                className="w-full px-5 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-900 rounded-xl font-semibold hover:from-yellow-400 hover:to-amber-400 transition-all duration-200 disabled:opacity-50 disabled:hover:from-yellow-500 disabled:hover:to-amber-500 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-105 disabled:hover:scale-100 shadow-xl shadow-yellow-500/30 text-sm sm:text-base"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" color="white" />
                    <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  </>
                )}
              </button>
            </form>

            {/* Toggle Auth Mode */}
            <div className="mt-6 text-center">
              <p className="text-indigo-300/80 text-sm">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  onClick={toggleAuthMode}
                  disabled={isLoading || isGoogleLoading}
                  className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors disabled:opacity-50"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>

            {/* Terms and Privacy (Sign Up Only) */}
            {isSignUp && (
              <div className="mt-6 text-center">
                <p className="text-indigo-400/60 text-xs leading-relaxed">
                  By creating an account, you agree to our{' '}
                  <a href="#" className="text-yellow-400 hover:text-yellow-300 transition-colors">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-yellow-400 hover:text-yellow-300 transition-colors">
                    Privacy Policy
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2 text-indigo-400/60 text-sm">
              {connectionStatus.isOffline ? (
                <>
                  <WifiOff className="w-4 h-4" />
                  <span>Running in offline mode</span>
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  <span>Secure authentication powered by Supabase</span>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;