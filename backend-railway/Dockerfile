FROM node:20-slim

# Install Python, ffmpeg, curl, and git
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install the latest yt-dlp directly from the master branch
RUN pip3 install --break-system-packages --force-reinstall https://github.com/yt-dlp/yt-dlp/archive/master.tar.gz

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
