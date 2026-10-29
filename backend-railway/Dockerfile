FROM node:20-bookworm-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      ca-certificates \
      python3 \
      git \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp STABLE binary (From your old rip project)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Clone and build the POT provider (v2.0.2)
RUN git clone --single-branch --branch 2.0.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /pot-provider \
    && cd /pot-provider/server \
    && npm install \
    && npx tsc

WORKDIR /app

COPY package.json* ./
RUN if [ -f package.json ]; then npm install --omit=dev; fi
RUN npm install express cors

COPY . .

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Start POT server, then Node server
CMD ["sh", "-c", "node /pot-provider/server/build/main.js & node server.js"]
