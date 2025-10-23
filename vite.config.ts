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
      // 🔒 HTTPS for iOS microphone access (self-signed certificate)
      https: fs.existsSync('./dev-cert.pem') ? {
        key: fs.readFileSync('./dev-key.pem'),
        cert: fs.readFileSync('./dev-cert.pem'),
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
