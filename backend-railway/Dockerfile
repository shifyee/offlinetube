FROM node:20-bookworm-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      ca-certificates \
      python3 \
      git \
      unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (Required for yt-dlp to solve YouTube signatures)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install yt-dlp NIGHTLY binary (Updated daily to bypass YouTube's newest blocks)
RUN curl -L https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp \
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
ENV PATH="/root/.deno/bin:${PATH}"
EXPOSE 8080

# Start POT server, then Node server
CMD ["sh", "-c", "node /pot-provider/server/build/main.js & node server.js"]
