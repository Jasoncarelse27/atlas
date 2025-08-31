# Atlas Backend

A Node.js backend server for the Atlas AI application, optimized for Railway deployment.

## 🚀 Railway Deployment

This backend is configured for easy deployment on Railway:

### Quick Deploy
1. Connect your GitHub repository to Railway
2. Railway will automatically detect the Node.js backend
3. Set environment variables in Railway dashboard
4. Deploy!

### Environment Variables
Set these in your Railway project:
- `PORT` - Railway sets this automatically
- `NODE_ENV` - Set to `production`
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

### Health Check
The backend includes a health check endpoint at `/healthz` that Railway uses to verify the deployment.

## 🛠 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## 📡 API Endpoints

- `GET /healthz` - Health check endpoint
- `GET /api/health` - API health status
- `GET /api/status` - Detailed server status

## 🔧 Configuration

The server automatically:
- Uses Railway's `PORT` environment variable
- Enables CORS for production origins
- Includes security headers with Helmet
- Compresses responses
- Logs requests with Morgan

## 📦 Build Process

No build step required - this is a pure Node.js backend that runs directly.
