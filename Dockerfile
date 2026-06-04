# Build stage — installs deps and builds the React client
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install all deps including devDeps (vite, tailwind) needed for the build
RUN npm install --include=dev

# Copy source and build client
COPY . .
RUN npm run build

# Production stage — lean image, no devDeps
FROM node:20-alpine AS runner
WORKDIR /app

# Only copy what the server needs at runtime
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --workspace server --omit=dev

COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
# Fly sets PORT via env; default 8080 matches Fly's internal port
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/index.js"]
