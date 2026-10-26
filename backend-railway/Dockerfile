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

# Install Deno (for the n-challenge solver and POT provider)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install the latest yt-dlp with all optional dependencies
RUN pip3 install --break-system-packages "yt-dlp[default]"

# Install the bgutil POT provider plugin
RUN mkdir -p /usr/local/lib/yt_dlp_plugins/extractor/ && \
    curl -L https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/latest/download/bgutil-ytdlp-pot-provider.zip -o /tmp/pot-provider.zip && \
    unzip /tmp/pot-provider.zip -d /usr/local/lib/yt_dlp_plugins/ && \
    rm /tmp/pot-provider.zip

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Start the POT provider in the background and then start the app
CMD ["sh", "-c", "deno run --allow-net --allow-io --allow-env --allow-run --allow-read --allow-write https://raw.githubusercontent.com/Brainicism/bgutil-ytdlp-pot-provider/master/server/src/main.ts & node server.js"]
