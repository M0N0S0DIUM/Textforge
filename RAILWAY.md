# Deploying TextForge to Railway

This guide covers deploying the TextForge API to [Railway](https://railway.app).

## Prerequisites

- A [Railway account](https://railway.app)
- Your code pushed to GitHub (optional, for auto-deployment)
- Node.js 18+ locally (for testing)
- Railway CLI installed (optional, `npm install -g @railway/cli`)

## Deployment Options

### Option 1: Deploy from GitHub (Recommended)

1. **Push your code to GitHub**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Create a new Railway project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your TextForge repository

3. **Add required services**

   ### Add Redis Service
   ```bash
   # Via dashboard:
   1. Go to your project in Railway
   2. Click "Add Service" → "Redis"
   
   # Or via CLI:
   railway services add redis
   ```

   ### Add PostgreSQL Service (Recommended for production)
   ```bash
   # Via dashboard:
   1. Click "Add Service" → "PostgreSQL"
   
   # Or via CLI:
   railway services add postgresql
   ```

4. **Set environment variables**

   In the Railway dashboard or using the CLI:

   ```bash
   railway variables set NODE_ENV=production
   railway variables set PORT=3000
   
   # Generate a secure API key secret (run locally):
   openssl rand -hex 32
   railway variables set API_KEY_SECRET=<your-generated-secret>
   
   # Railway will auto-set these from your services:
   # DATABASE_URL (from PostgreSQL)
   # REDIS_URL (from Redis)
   ```

5. **Deploy**
   ```bash
   # Via dashboard: Click "Deploy"
   # Or via CLI:
   railway up
   ```

### Option 2: Deploy with Railway CLI

1. **Login to Railway**

   ```bash
   railway login
   ```

2. **Initialize project**

   ```bash
   railway init
   railway link  # Select or create a project
   ```

3. **Add services**

   ```bash
   railway services add redis
   railway services add postgresql
   ```

4. **Set environment variables**

   ```bash
   railway variables set NODE_ENV=production
   railway variables set PORT=3000
   railway variables set API_KEY_SECRET=$(openssl rand -hex 32)
   ```

5. **Deploy**

   ```bash
   railway up
   ```

## Railway Configuration

### Railway.json

Your project includes a `railway.json` file that configures:

- Build: Uses the Dockerfile
- Start command: `npm start`
- Health check: `/health`
- Restart policy: ON_FAILURE with max 10 retries

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Set to `production` for production builds |
| `PORT` | No | `3000` | Railway sets this automatically |
| `DATABASE_URL` | Yes (PostgreSQL) | - | Railway auto-sets from PostgreSQL service |
| `REDIS_URL` | No | - | Railway auto-sets from Redis service |
| `API_KEY_SECRET` | Yes | - | 32+ character random string for API key hashing |

## Services

### Redis

Redis is **optional** but highly recommended. Without it:

- Rate limits reset on restart
- Cache is per-instance only (not shared across replicas)
- Use only for local development or single instances

Enable via `REDIS_URL` environment variable.

### PostgreSQL

PostgreSQL is the **recommended database** for production. It provides:

- Better concurrency handling than SQLite
- Automatic backups (with Railway PostgreSQL)
- Easier scaling
- Railway auto-manages connections

#### ⚠️ Important: Only 1 PostgreSQL Service Needed

If you see multiple PostgreSQL services in your Railway dashboard, **delete all but one**:

1. Go to [railway.app](https://railway.app) → Your Project → Services
2. Look for any duplicate PostgreSQL databases (may be named `postgres`, `postgresql`, or similar)
3. For each duplicate service:
   - Click on the service
   - Go to **Settings** → **Danger Zone**
   - Click **Delete Service**
4. Keep only ONE PostgreSQL service and ONE Redis service
5. The remaining services should automatically share environment variables

After cleanup, verify your `DATABASE_URL` variable points to your single database.

## Monitoring & Logs

View logs in Railway:
```bash
railway logs
```

Or view them in the Railway dashboard under "Logs".

## Health Check

The `/health` endpoint is automatically checked by Railway. It returns:

- Database status
- Redis connectivity
- Migration status
- Cache statistics

Example response:
```json
{
  "success": true,
  "status": "healthy",
  "uptime_seconds": 3600,
  "database": "healthy",
  "redis": "connected",
  "migrations": "completed",
  "cache": {
    "redisAvailable": true,
    "memoryCacheSize": 42,
    "maxCacheSize": 1000
  },
  "version": "1.0.0"
}
```

## Scaling

### Manual Scaling

In Railway dashboard or via CLI:
```bash
railway scale replicas 3  # Scale to 3 instances
```

With Redis enabled, rate limits are shared across all instances.

### Auto-Scaling

Railway automatically scales based on traffic and resource usage.

## Cost Estimation

**Free tier**: $5/month credit (usually sufficient for low-medium traffic)

**Typical monthly cost**:
- 1 small instance: ~$2-5
- Redis: ~$0-3
- PostgreSQL: ~$0-10 (based on size)
- **Total**: Usually under $15/month for moderate usage

## Troubleshooting

### Database Migration Errors

If migrations fail:

1. Check logs: `railway logs`
2. Verify DATABASE_URL is set correctly
3. For development, you can manually reset the database in Railway dashboard

### Redis Connection Issues

Redis errors are non-fatal - TextForge falls back to in-memory mode with a warning.

To fix:
1. Ensure Redis service is added
2. Verify REDIS_URL environment variable
3. Check Redis service status in dashboard

### API Key Validation Errors

Make sure `API_KEY_SECRET` is set and is at least 32 characters of random data:

```bash
# Generate locally
openssl rand -hex 32
```

## Updating Your Deployment

When you push to your GitHub repo (or run `railway up`), Railway will automatically redeploy with the latest code.

For incremental updates:
1. Make changes locally
2. Commit and push: `git push origin main`
3. Railway auto-deploys

## Testing Before Deploy

Test locally with Docker Compose:
```bash
# Start services
docker-compose up -d

# Test API
curl http://localhost:3000/health
```

Or test directly:
```bash
npm install
cp .env.example .env  # Edit with your configuration
npm start
```

## Support

For issues:

1. Check Railway logs: `railway logs`
2. Review the main README.md for API usage
3. Check Railway status page for outages
