# ============================================================
# Stage 1: Builder
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies needed for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++ openssl

# Copy package files
COPY package.json yarn.lock ./

# Install ALL dependencies (including dev) for building
RUN yarn install --frozen-lockfile

# Copy source code and config files
COPY . .

# Generate Prisma client
RUN yarn prisma generate

# Build NestJS application
RUN yarn build

# ============================================================
# Stage 2: Production
# ============================================================
FROM node:22-alpine AS production

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Set node environment
ENV NODE_ENV=production

# Copy package files
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy Prisma schema, config and generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY prisma.config.ts ./

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 8080

# Use entrypoint script to run migrations then start app
ENTRYPOINT ["./docker-entrypoint.sh"]
