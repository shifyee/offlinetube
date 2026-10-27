FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 python3-pip ffmpeg curl unzip git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages "yt-dlp[default]"

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

ENV PORT=8080
ENV YTDLP=/usr/local/bin/yt-dlp

# THE FIX: Update yt-dlp on boot before starting the server
CMD ["sh", "-c", "yt-dlp -U >/dev/null 2>&1 || true; node server.js"]
