# TextForge API - Railway-optimized Dockerfile
# This Dockerfile is optimized for Railway's build system

# ---- Base Stage (Install all deps including dev for building) ----
FROM node:18-alpine AS base

# Install wget and PostgreSQL client libraries for node-postgres
RUN apk add --no-cache wget postgresql-client

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY textforge-dashboard/package*.json ./textforge-dashboard/

# Install all dependencies (including dev for building dashboard)
RUN npm ci && \
    cd textforge-dashboard && npm ci && \
    cd .. && npm cache clean --force

# ---- Build Dashboard Stage ----
FROM base AS dashboard-builder

WORKDIR /app

# Copy source files
COPY . .

# Build the Next.js dashboard
RUN cd textforge-dashboard && npm run build

# ---- Production Stage ----
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production node_modules from base
COPY --from=base --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodejs:nodejs . .

# Copy built dashboard from builder stage (static HTML + assets)
COPY --from=dashboard-builder --chown=nodejs:nodejs /app/textforge-dashboard/.next ./textforge-dashboard/.next
COPY --from=dashboard-builder --chown=nodejs:nodejs /app/textforge-dashboard/public ./textforge-dashboard/public

# Change to non-root user
USER nodejs

# Expose port (Railway will set PORT env variable)
EXPOSE 3000

# Health check - Railway uses this to monitor your service
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Start the application
CMD ["npm", "start"]
