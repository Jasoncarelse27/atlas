import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enhanced validation with better error messages
const validateSupabaseConfig = () => {
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not defined. Please click the "Connect to Supabase" button to set up your project.');
  }

  if (!supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY is not defined. Please click the "Connect to Supabase" button to set up your project.');
  }

  // Validate URL format
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error('Invalid Supabase URL format. Please click the "Connect to Supabase" button to reconfigure your project.');
  }

  // Check if URL looks like a Supabase URL
  if (!supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('localhost')) {
    console.warn('⚠️ URL does not appear to be a valid Supabase URL:', supabaseUrl);
  }

  // Basic validation for API key format
  if (supabaseAnonKey.length < 100) {
    console.warn('⚠️ API key appears to be too short, please verify it is correct');
  }
};

// Detect WebContainer environment
const isWebContainer = () => {
  return (
    typeof window !== 'undefined' && 
    (
      window.location.hostname.endsWith('.webcontainer.io') ||
      window.location.hostname.includes('webcontainer-api.io') ||
      window.location.hostname.includes('local-credentialless') ||
      window.location.hostname.includes('stackblitz') ||
      // Additional WebContainer detection patterns
      document.referrer.includes('stackblitz') ||
      navigator.userAgent.includes('WebContainer')
    )
  );
};

// Create a comprehensive mock client for offline mode
const createMockClient = (errorMessage: string) => {
  const mockError = new Error(errorMessage);
  
  return {
    auth: {
      getSession: () => Promise.resolve({ 
        data: { session: null }, 
        error: null // Don't return error for session check in offline mode
      }),
      onAuthStateChange: (callback: any) => {
        // Call callback immediately with no session
        setTimeout(() => callback('SIGNED_OUT', null), 0);
        return { 
          data: { 
            subscription: { 
              unsubscribe: () => {} 
            } 
          } 
        };
      },
      signOut: () => Promise.resolve({ error: null }),
      signInWithPassword: () => Promise.resolve({ 
        data: { user: null, session: null }, 
        error: mockError 
      }),
      signUp: () => Promise.resolve({ 
        data: { user: null, session: null }, 
        error: mockError 
      }),
      getUser: () => Promise.resolve({
        data: { user: null },
        error: null
      })
    },
    from: (table: string) => ({
      select: (columns?: string) => ({
        eq: (column: string, value: any) => ({
          single: () => Promise.resolve({ 
            data: null, 
            error: mockError 
          }),
          limit: (count: number) => ({
            single: () => Promise.resolve({ 
              data: null, 
              error: mockError 
            })
          }),
          order: (column: string, options?: any) => Promise.resolve({
            data: [],
            error: mockError
          })
        }),
        limit: (count: number) => ({
          single: () => Promise.resolve({ 
            data: null, 
            error: mockError 
          })
        }),
        order: (column: string, options?: any) => Promise.resolve({
          data: [],
          error: mockError
        }),
        range: (from: number, to: number) => Promise.resolve({
          data: [],
          error: mockError
        })
      }),
      insert: (values: any) => ({
        select: (columns?: string) => ({
          single: () => Promise.resolve({ 
            data: null, 
            error: mockError 
          })
        })
      }),
      update: (values: any) => ({
        eq: (column: string, value: any) => Promise.resolve({ 
          error: mockError 
        })
      }),
      upsert: (values: any) => Promise.resolve({ 
        error: mockError 
      }),
      delete: () => ({
        eq: (column: string, value: any) => Promise.resolve({
          error: mockError
        })
      })
    }),
    rpc: (functionName: string, params?: any) => Promise.resolve({ 
      data: null, 
      error: mockError 
    }),
    storage: {
      from: (bucket: string) => ({
        upload: () => Promise.resolve({ error: mockError }),
        download: () => Promise.resolve({ error: mockError }),
        remove: () => Promise.resolve({ error: mockError }),
        list: () => Promise.resolve({ data: [], error: mockError })
      })
    }
  };
};

// Only validate and create client if config exists
let supabase: any = null;
let configError: string | null = null;
let isOfflineMode = false;

try {
  validateSupabaseConfig();
  
  // Check if we're in WebContainer environment
  if (isWebContainer()) {
    console.log('🔗 WebContainer environment detected - initializing in offline mode');
    isOfflineMode = true;
    configError = 'Running in offline mode due to WebContainer network restrictions';
    supabase = createMockClient(configError);
  } else {
    // Create real client for production environments
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      global: {
        headers: {
          'apikey': supabaseAnonKey
        }
      },
      // Add retry configuration to handle network issues gracefully
      db: {
        schema: 'public'
      },
      // Configure realtime to be more resilient
      realtime: {
        params: {
          eventsPerSecond: 2
        }
      }
    });
    console.log('✅ Supabase client initialized successfully');
  }
} catch (error) {
  configError = error instanceof Error ? error.message : 'Unknown configuration error';
  console.error('❌ Supabase configuration error:', configError);
  isOfflineMode = true;
  
  // Create a mock client that will always fail gracefully
  supabase = createMockClient(configError);
}

export { supabase, isOfflineMode };

// Enhanced test connection function with better error handling and timeout
export const testConnection = async (retries = 1, delay = 1000) => {
  // Return configuration error immediately if present
  if (configError && !isOfflineMode) {
    return {
      success: false,
      error: configError
    };
  }

  // If we're in offline mode, return appropriate status
  if (isOfflineMode) {
    return {
      success: false,
      error: 'Running in offline mode. Database features are limited in the WebContainer environment.',
      offline: true
    };
  }

  // Validate environment variables first
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      error: 'Supabase configuration is missing. Please click the "Connect to Supabase" button in the top right to set up your project.'
    };
  }

  // Check if running in WebContainer environment and skip fetch to prevent console errors
  if (isWebContainer()) {
    console.log('🔗 WebContainer environment detected - skipping network test to prevent fetch errors');
    return {
      success: false,
      error: 'Unable to establish connection to Supabase. This is expected in the WebContainer environment due to network restrictions. The application will continue in offline mode with limited functionality.',
      offline: true
    };
  }

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔗 Connection attempt ${i + 1}/${retries} to ${supabaseUrl}...`);
      
      // Use a shorter timeout for WebContainer environment to fail fast
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Connection timeout after 5 seconds');
        controller.abort();
      }, 5000); // Reduced timeout to 5 seconds for faster failure detection
      
      try {
        // Try a simple health check with CORS-friendly options
        const healthCheck = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'HEAD', // Use HEAD instead of GET to reduce data transfer
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal,
          mode: 'cors', // Explicitly set CORS mode
          credentials: 'omit' // Don't send credentials to avoid CORS issues
        });

        clearTimeout(timeoutId);

        console.log(`🔗 Health check response: ${healthCheck.status} ${healthCheck.statusText}`);

        if (healthCheck.ok) {
          console.log('✅ Supabase connection successful (health check)');
          return { success: true, data: { status: 'connected' } };
        }

        // If health check fails with 4xx, it might be auth related
        if (healthCheck.status >= 400 && healthCheck.status < 500) {
          console.error('🔑 Authentication error:', healthCheck.status);
          return {
            success: false,
            error: 'Authentication failed. Please verify your Supabase API key is correct and click "Connect to Supabase" to reconfigure.'
          };
        }

        // For other HTTP errors, return a generic error
        return {
          success: false,
          error: `HTTP ${healthCheck.status}: Unable to connect to Supabase. Please check your project status and configuration.`
        };
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            console.log('⏰ Health check timed out');
            // Don't retry on timeout in WebContainer - fail fast
            return {
              success: false,
              error: 'Connection timeout. This is likely due to network restrictions in the WebContainer environment. The application will continue in offline mode with limited functionality.',
              offline: true
            };
          } else if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
            console.warn('🔗 Network error:', fetchError.message);
            // Don't retry on network errors in WebContainer - fail fast
            return {
              success: false,
              error: 'Network connection failed. This is likely due to CORS restrictions or network limitations in the WebContainer environment. The application will continue in offline mode with limited functionality.',
              offline: true
            };
          } else {
            console.warn('🔗 Fetch error:', fetchError.message);
            return {
              success: false,
              error: `Connection error: ${fetchError.message}. The application will continue in offline mode.`,
              offline: true
            };
          }
        }
      }
      
    } catch (error) {
      console.warn(`🔗 Connection attempt ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
      
      // Don't retry in WebContainer environment - fail fast and gracefully
      return { 
        success: false, 
        error: 'Unable to establish connection to Supabase. This is expected in the WebContainer environment due to network restrictions. The application will continue in offline mode with limited functionality.',
        offline: true
      };
    }
  }

  // If all retries failed, provide clear guidance
  return { 
    success: false, 
    error: 'Unable to establish connection to Supabase. This is expected in the WebContainer environment due to network restrictions. The application will continue in offline mode with limited functionality.',
    offline: true
  };
};

// Helper function to check if we're in offline mode
export const getConnectionStatus = () => ({
  isOffline: isOfflineMode,
  error: configError,
  isWebContainer: isWebContainer()
});

// Helper function for graceful error handling in components
export const handleSupabaseError = (error: any, operation: string = 'database operation') => {
  if (isOfflineMode) {
    console.log(`🔄 ${operation} skipped - running in offline mode`);
    return {
      success: false,
      error: `${operation} unavailable in offline mode`,
      offline: true
    };
  }
  
  console.error(`❌ ${operation} failed:`, error);
  return {
    success: false,
    error: error?.message || `${operation} failed`,
    offline: false
  };
};
