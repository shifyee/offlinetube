FROM node:20-slim

# Install Python, ffmpeg, curl, unzip, and git
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (JavaScript runtime for solving YouTube challenges)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install the latest yt-dlp with all optional dependencies
RUN pip3 install --break-system-packages "yt-dlp[default]"

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV PORT=8080
ENV YTDLP=/usr/local/bin/yt-dlp
ENV NODE_ENV=production

EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
