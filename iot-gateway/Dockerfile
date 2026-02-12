FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source and build
COPY tsconfig.json ./
COPY src ./src

# Install dev deps temporarily for build, then remove
RUN npm install typescript @types/node @types/express @types/cors @types/node-fetch --save-dev && \
    npx tsc && \
    npm prune --omit=dev

# Cloud Run uses PORT env var
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
