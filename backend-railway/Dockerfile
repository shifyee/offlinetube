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

# Install Deno (JavaScript runtime for YouTube challenges)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install the nightly yt-dlp via pip
RUN pip3 install --break-system-packages --force-reinstall --pre "yt-dlp[default]"

# Install the POT provider plugin
RUN mkdir -p /usr/local/lib/yt_dlp_plugins/extractor/ && \
    curl -L https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/latest/download/bgutil-ytdlp-pot-provider.zip -o /tmp/pot-provider.zip && \
    unzip /tmp/pot-provider.zip -d /usr/local/lib/yt_dlp_plugins/ && \
    rm /tmp/pot-provider.zip

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV PORT=8080
ENV YTDLP=/usr/local/bin/yt-dlp
ENV NODE_ENV=production
EXPOSE 8080

# THE FIX: Use --allow-all to ensure Deno starts the POT provider without permission errors
CMD ["sh", "-c", "deno run --allow-all https://raw.githubusercontent.com/Brainicism/bgutil-ytdlp-pot-provider/master/server/src/main.ts & node server.js"]
