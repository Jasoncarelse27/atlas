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
          // ✅ CRITICAL FIX: Keep zustand in main bundle to preserve exports
          manualChunks: (id) => {
            // DON'T chunk zustand separately - keep it in main bundle for proper module resolution
            // Put other node_modules in vendor chunk
            if (id.includes('node_modules') && !id.includes('zustand')) {
              return 'vendor';
            }
          },
          // ✅ CRITICAL FIX: Preserve all exports (not just entry points)
          preserveModules: false,
          // ✅ CRITICAL FIX: Ensure exports are preserved
          exports: 'named',
        },
        // Fix react-is import resolution for recharts
        // Ensure react-is is bundled, not externalized
        external: []
      },
      // ✅ CRITICAL FIX: Mark zustand as having side effects to prevent tree-shaking
      // This ensures 'create' export is preserved through re-export chains
      treeshake: {
        moduleSideEffects: (id) => {
          // Prevent tree-shaking of zustand to preserve all exports
          if (id.includes('zustand')) {
            return true;
          }
          return false;
        }
      },
      // ✅ CRITICAL FIX: Ensure zustand is properly resolved in production build
      commonjsOptions: {
        include: [/zustand/, /node_modules/],
        transformMixedEsModules: true
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
