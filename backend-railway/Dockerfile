FROM node:20-bookworm-slim

# System dependencies (Removed xvfb and playwright to save RAM)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      ca-certificates \
      python3 \
      git \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp NIGHTLY binary (This is the standalone executable with latest fixes)
RUN curl -L https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Clone and build the POT provider (v2.0.2)
RUN git clone --single-branch --branch 2.0.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /pot-provider \
    && cd /pot-provider/server \
    && npm install \
    && npx tsc

WORKDIR /app

# Copy package.json and install Node dependencies (express, cors)
COPY package.json* ./
RUN if [ -f package.json ]; then npm install --omit=dev; fi
# Fallback in case package.json is missing express/cors
RUN npm install express cors

# Copy the rest of your app files (server.js, index.html, etc.)
COPY . .

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Start the POT server in the background, then run the Node server
CMD ["sh", "-c", "node /pot-provider/server/build/main.js & node server.js"]
