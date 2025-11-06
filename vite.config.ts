import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

// ✅ Zustand Rollup safeguard plugin
function preserveZustand(): Plugin {
  return {
    name: 'preserve-zustand-export',
    resolveId(source) {
      if (source.includes('zustand')) {
        // Force Vite to treat Zustand as an external ESM module
        return { id: source, external: false }
      }
      return null
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react(), preserveZustand()],
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
        'react-native-web',
        'zustand' // ✅ CRITICAL: Exclude Zustand from pre-bundling to prevent export stripping
      ],
      include: [
        'react-is' // ✅ Fix Railway build: Ensure react-is is pre-bundled
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
      // ✅ Automatic cache busting - inject build timestamp
      define: {
        'import.meta.env.VITE_BUILD_TIME': JSON.stringify(Date.now().toString()),
        'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(process.env.VITE_BUILD_VERSION || Date.now().toString()),
      },
      // ✅ CRITICAL FIX: Preserve Zustand wrapper and all zustand modules
      // Prevents Vercel/Rollup from tree-shaking the create export
      treeshake: {
        moduleSideEffects: (id) => {
          // ✅ CRITICAL: Preserve wrapper module - critical for Zustand create export
          if (id.includes('zustand-wrapper') || id.includes('lib/zustand-wrapper')) {
            return true; // Has side effects - cannot be tree-shaken
          }
          // ✅ CRITICAL: Preserve vercel-rebuild module - ensures export chain is included
          if (id.includes('vercel-rebuild') || id.includes('lib/vercel-rebuild')) {
            return true; // Has side effects - cannot be tree-shaken
          }
          // ✅ CRITICAL: Never tree-shake Zustand (fix for Vercel/production)
          if (/node_modules\/zustand/.test(id)) {
            return true;
          }
          // ✅ Preserve ALL zustand modules - never tree-shake anything from zustand
          if (id.includes('zustand')) {
            return true;
          }
          return false;
        },
      },
      // ✅ Use esbuild minifier (less aggressive than Terser, preserves exports better)
      // esbuild doesn't mangle export names, which fixes the 'create' export issue
      minify: 'esbuild',
      // Note: esbuild doesn't support terserOptions, but it's safer for exports
      // ✅ CRITICAL FIX: Rollup options - preserve all exports
      rollupOptions: {
        plugins: [preserveZustand()], // ✅ Apply safeguard plugin
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
          // ✅ CRITICAL FIX: Preserve module structure (direct imports from zustand/react)
          preserveModules: false,
          // ✅ CRITICAL FIX: Explicitly preserve zustand exports
          generatedCode: {
            constBindings: false, // Use let/var instead of const for better compatibility
          },
          // ✅ CRITICAL FIX: Ensure zustand/react exports are preserved
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
