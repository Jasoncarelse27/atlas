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
      dedupe: [
        'react-is', // ✅ Fix Railway build: Ensure single react-is instance
        'zustand' // ✅ Fix Railway build: Ensure single zustand instance
      ],
      // ✅ CRITICAL FIX: Force ESM resolution for zustand
      conditions: ['import', 'module', 'default'],
    },
    optimizeDeps: {
      exclude: [
        'expo-av',
        'expo-file-system',
        'expo-image-picker',
        'expo-image-manipulator',
        'react-native',
        'react-native-web'
      ],
      include: [
        'react-is', // ✅ Fix Railway build: Ensure react-is is pre-bundled
        'zustand' // ✅ Fix Railway build: Ensure zustand's create export is resolved
      ],
      // ✅ CRITICAL FIX: Force ESM resolution for zustand during dev pre-bundling
      esbuildOptions: {
        // Don't transform zustand - keep it as ESM
        target: 'esnext',
      }
    },
    base: process.env.NODE_ENV === 'production' ? '/' : '/',
    build: {
      outDir: 'dist',
      sourcemap: false,
      emptyOutDir: true, // 🔧 Force clean build to prevent cache issues
      // ✅ CRITICAL FIX: Enable selective tree-shaking but preserve zustand wrapper
      treeshake: {
        moduleSideEffects: (id) => {
          // ✅ Preserve zustand wrapper module - never tree-shake it
          if (id.includes('zustand') || id.includes('lib/zustand')) {
            return true;
          }
          return false;
        },
      },
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: ['log', 'debug'],  // Remove console.log and console.debug from production
          drop_debugger: true
        }
      },
      // ✅ CRITICAL FIX: Rollup options - preserve all exports
      rollupOptions: {
        // ✅ CRITICAL FIX: Preserve entry signatures to keep exports (must be at root level)
        preserveEntrySignatures: 'strict',
        // ✅ CRITICAL FIX: Ensure zustand is bundled, not externalized
        external: [],
        output: {
          // ✅ CRITICAL FIX: Ensure exports are preserved
          exports: 'named',
          // ✅ CRITICAL FIX: Enable cache-busting filenames with content hash
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          // ✅ CRITICAL FIX: Preserve zustand exports in bundle - use ES format
          format: 'es',
          // ✅ CRITICAL FIX: Preserve module structure for wrapper
          preserveModules: false,
          // ✅ CRITICAL FIX: Explicitly preserve zustand exports
          generatedCode: {
            constBindings: false, // Use let/var instead of const for better compatibility
          },
          // ✅ CRITICAL FIX: Ensure zustand wrapper module exports are preserved
          interop: 'compat',
        },
      },
      // ✅ CRITICAL FIX: Ensure zustand is properly resolved in production build
      commonjsOptions: {
        include: [/zustand/, /node_modules/],
        transformMixedEsModules: true,
        // ✅ Force proper module resolution for zustand
        requireReturnsDefault: 'auto',
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
