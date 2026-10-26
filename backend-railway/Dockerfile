FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      ca-certificates \
      python3 \
    && rm -rf /var/lib/apt/lists/*

# standalone yt-dlp binary from the latest release
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

ENV PORT=8080
ENV YTDLP=/usr/local/bin/yt-dlp
ENV NODE_ENV=production
EXPOSE 8080

# refresh yt-dlp on boot so a stale build doesn't break next month
CMD ["sh", "-c", "yt-dlp -U >/dev/null 2>&1 || true; exec node server.js"]
