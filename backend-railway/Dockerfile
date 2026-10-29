FROM node:20-bookworm-slim

# System dependencies (Removed xvfb and playwright to save RAM)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      ca-certificates \
      python3 \
      git \
      tar \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp from the absolute latest master branch 
# (This bypasses the buggy "latest" release and fixes the PO Token stall)
RUN curl -L https://github.com/yt-dlp/yt-dlp/archive/master.tar.gz | tar xz -C /tmp \
    && mv /tmp/yt-dlp-master/yt-dlp /usr/local/bin/yt-dlp \
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
