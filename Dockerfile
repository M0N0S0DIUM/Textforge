# TextForge API - Railway-optimized Dockerfile
# This Dockerfile is optimized for Railway's build system

# ---- Base Stage ----
FROM node:18-alpine AS base

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# ---- Production Stage ----
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy from base stage
COPY --from=base --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Change to non-root user
USER nodejs

# Expose port (Railway will set PORT env variable)
EXPOSE 3000

# Health check - Railway uses this to monitor your service
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Start the application
CMD ["npm", "start"]
