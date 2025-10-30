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
      emptyOutDir: true, // 🔧 Force clean build to prevent cache issues
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: ['log', 'debug'],  // Remove console.log and console.debug from production
          drop_debugger: true
        }
      },
      rollupOptions: {
        output: {
          // 🔧 SIMPLIFIED: Use Vite's proven default chunking strategy
          // This fixes atlasDB export issues and follows industry best practices
          // Vite automatically handles optimal chunking for production builds
        }
      }
    },
    server: {
      host: '0.0.0.0', // Allow external connections
      port: 5174,
      // 🔒 HTTPS for iOS microphone access (mkcert trusted certificates)
      https: fs.existsSync('./localhost+1.pem') ? {
        key: fs.readFileSync('./localhost+1-key.pem'),
        cert: fs.readFileSync('./localhost+1.pem'),
      } : undefined,
      proxy: {
        // API routes
        '/v1': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false, // Accept self-signed certs in development
          ws: true, // Enable WebSocket support
          configure: (proxy, options) => {
            proxy.on('error', (err) => {
              console.error('Proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log('Proxying:', req.method, req.url, '→', options.target + req.url);
            });
          }
        },
        '/api': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          ws: true
        },
        '/message': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
})
