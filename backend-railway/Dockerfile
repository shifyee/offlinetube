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

# Install Deno (Required for yt-dlp JS challenges)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install yt-dlp nightly binary
RUN curl -L https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Clone and build the POT provider server
RUN git clone --single-branch --branch 2.0.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /pot-provider \
    && cd /pot-provider/server \
    && npm install \
    && npx tsc

# Install the yt-dlp plugin as a .zip file in the correct directory
RUN mkdir -p /root/.config/yt-dlp/plugins \
    && curl -L https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/2.0.2/bgutil-ytdlp-pot-provider.zip \
         -o /root/.config/yt-dlp/plugins/bgutil-ytdlp-pot-provider.zip

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
