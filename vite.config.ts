import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      exclude: [
        'expo-av',
        'expo-file-system',
        'expo-image-picker',
        'expo-image-manipulator',
        'react-native',
        'react-native-web'
      ]
    },
    base: process.env.NODE_ENV === 'production' ? '/' : '/',
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: ['log', 'debug'],  // Remove console.log and console.debug from production
          drop_debugger: true
        },
        mangle: false // 🔧 FIX: Completely disable mangling to preserve all export names
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // React and core libraries
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react';
            }
            // UI libraries
            if (id.includes('node_modules/framer-motion') || id.includes('node_modules/lucide-react')) {
              return 'ui';
            }
            // Supabase and auth
            if (id.includes('node_modules/@supabase') || id.includes('node_modules/@auth')) {
              return 'auth';
            }
            // Query and state management
            if (id.includes('node_modules/@tanstack') || id.includes('node_modules/react-query')) {
              return 'state';
            }
            // Other node_modules
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            // Chat features
            if (id.includes('src/features/chat')) {
              return 'chat';
            }
            // Subscription features (including database dependencies)
            if (id.includes('src/features/subscription') || 
                id.includes('src/hooks/useSubscription') ||
                id.includes('src/services/subscriptionApi') ||
                id.includes('src/database/atlasDB')) {
              return 'subscription';
            }
          }
        }
      }
    },
    server: {
      host: '0.0.0.0', // Allow external connections
      port: 5174,
      // 🔒 HTTPS for iOS microphone access
      https: fs.existsSync('.cert/localhost+1.pem') ? {
        key: fs.readFileSync('.cert/localhost+1-key.pem'),
        cert: fs.readFileSync('.cert/localhost+1.pem'),
      } : undefined,
      proxy: {
        '/v1': {
          target: 'http://localhost:8000',
          changeOrigin: true
        },
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true
        },
        '/message': {
          target: 'http://localhost:8000',
          changeOrigin: true
        }
      }
    }
  }
})
