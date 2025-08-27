// Deployment Configuration for otiumcreations.com
module.exports = {
  // Production environment variables
  production: {
    NODE_ENV: 'production',
    PORT: 3001,
    ALLOWED_ORIGINS: 'https://otiumcreations.com,https://www.otiumcreations.com',
    CORS_ORIGIN: 'https://otiumcreations.com',
    
    // Supabase configuration
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    
    // AI API Keys
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100,
    AI_RATE_LIMIT_MAX: 30
  },
  
  // Development environment variables
  development: {
    NODE_ENV: 'development',
    PORT: 3001,
    ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000',
    CORS_ORIGIN: 'http://localhost:5173',
    
    // Supabase configuration
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    
    // AI API Keys
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 1000,
    AI_RATE_LIMIT_MAX: 100
  }
}; 