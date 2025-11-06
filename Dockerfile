# ✅ CRITICAL: Dockerfile to force Node.js (Railway was detecting Deno)
# Railway will use this Dockerfile instead of Nixpacks auto-detection
# This ensures Node.js is always used, not Deno

FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the frontend
RUN rm -rf dist node_modules/.vite && \
    npm run build && \
    echo '=== BUILD VERIFICATION ===' && \
    ls -la dist/assets/index-*.js && \
    echo '=== BUNDLE CREATED ===' && \
    cat dist/index.html | grep -o 'index-[^.]*\.js' | head -1

# Expose port
EXPOSE 3000

# Start backend server
CMD ["npm", "run", "backend"]

