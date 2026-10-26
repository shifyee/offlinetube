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

# Install the nightly yt-dlp via pip
RUN pip3 install --break-system-packages --force-reinstall --pre "yt-dlp[default]"

# Clone and build the POT provider (Node.js method)
RUN git clone --single-branch --branch master https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /pot-provider && \
    cd /pot-provider/server && \
    npm install && \
    npx tsc

# Set up the app directory
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV PORT=8080
ENV YTDLP=/usr/local/bin/yt-dlp
ENV NODE_ENV=production
EXPOSE 8080

# Start the POT provider in the background, then start the main server
CMD ["sh", "-c", "node /pot-provider/server/build/main.js & node server.js"]
