import React, { useState } from 'react';
import { User, Lock, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-4">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-10 shadow-2xl border border-white/30">
          {/* User Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-full border-2 border-white/40 flex items-center justify-center bg-white/10">
              <User className="w-10 h-10 text-white/80" strokeWidth={1.5} />
            </div>
          </div>

          <form onSubmit={handleLogin}>
            {/* Email Input */}
            <div className="mb-6">
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" strokeWidth={1.5} />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/30 border border-white/40 rounded-lg py-4 pl-12 pr-4 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/60 focus:border-transparent backdrop-blur-md transition-all duration-200"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="mb-6">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" strokeWidth={1.5} />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/30 border border-white/40 rounded-lg py-4 pl-12 pr-4 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/60 focus:border-transparent backdrop-blur-md transition-all duration-200"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && <div className="text-red-300 text-center mb-4">{error}</div>}

            {/* Login Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold py-4 px-6 rounded-lg hover:from-pink-600 hover:to-purple-600 transition-all duration-200 shadow-lg mb-6 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'LOGIN'}
            </button>
          </form>

          {/* Remember Me and Forgot Password */}
          <div className="flex items-center justify-between text-sm mt-2">
            <label className="flex items-center text-white/80 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 border-white/50 flex items-center justify-center ${rememberMe ? 'bg-white/30' : 'bg-transparent'} transition-all duration-200`}>
                  {rememberMe && <Check className="w-3 h-3 text-white" strokeWidth={2} />}
                </div>
              </div>
              <span className="ml-2">Remember me</span>
            </label>
            <a href="#" className="text-white/60 hover:text-white/90 transition-colors">
              Forgot your password?
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/60 text-sm">
            designed by <span className="text-white/80">🤍 otium</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;