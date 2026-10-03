FROM node:20-slim

# python3 powers the fast AST syntax check; without it checks silently skip
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ src/

CMD ["npm", "start"]
