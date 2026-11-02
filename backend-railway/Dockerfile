# language: Dockerfile, target: any Node host (Railway / Render / Fly.io / VPS)
FROM node:20-bookworm-slim

# system deps: ffmpeg for merge+convert, curl+ca-certificates to fetch yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      ca-certificates \
      python3 \
      git \
    && rm -rf /var/lib/apt/lists/*

# standalone yt-dlp binary — from your original rip project (stable release)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Clone and build the POT provider (v2.0.2) - Required for Railway IPs
RUN git clone --single-branch --branch 2.0.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /pot-provider \
    && cd /pot-provider/server \
    && npm install \
    && npx tsc

WORKDIR /app

# no npm deps, but keep the line so it's ready if you add any
COPY package.json* ./
RUN if [ -f package.json ]; then npm install --omit=dev; fi
RUN npm install express cors

COPY . .

ENV PORT=8080
ENV YTDLP=/usr/local/bin/yt-dlp
ENV NODE_ENV=production
EXPOSE 8080

# refresh yt-dlp on every boot, start POT server, then run Node server
CMD ["sh", "-c", "yt-dlp -U >/dev/null 2>&1 || true; node /pot-provider/server/build/main.js & node server.js"]
