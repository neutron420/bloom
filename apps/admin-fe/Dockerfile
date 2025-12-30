# Multi-stage build for optimized image size
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json* ./
COPY packages ./packages

# Copy app package files
COPY apps/admin-fe/package.json ./apps/admin-fe/

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy app source code
COPY apps/admin-fe ./apps/admin-fe
COPY turbo.json ./

# Set working directory to app
WORKDIR /app/apps/admin-fe

# Build Next.js app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
# The standalone output includes the server.js and all dependencies
COPY --from=builder /app/apps/admin-fe/public ./apps/admin-fe/public
COPY --from=builder /app/apps/admin-fe/.next/standalone ./
COPY --from=builder /app/apps/admin-fe/.next/static ./apps/admin-fe/.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3003

ENV PORT=3003
ENV HOSTNAME="0.0.0.0"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js server
# The standalone output places server.js at the root of the standalone directory
CMD ["node", "apps/admin-fe/server.js"]

