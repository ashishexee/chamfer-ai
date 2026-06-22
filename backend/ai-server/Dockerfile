FROM node:20-slim

WORKDIR /app

# Install deps (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ src/

CMD ["npm", "start"]
