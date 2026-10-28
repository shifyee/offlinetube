FROM node:20-slim

# Install Python, ffmpeg, curl, unzip, git, and Xvfb
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    git \
    xvfb \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (JavaScript runtime for the EJS solver)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install the EJS plugin and the latest nightly yt-dlp via pip
RUN pip3 install --break-system-packages --force-reinstall --pre "yt-dlp" yt-dlp-ejs

# Clone and build the POT provider
RUN git clone --single-branch --branch master https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /pot-provider && \
    cd /pot-provider/server && \
    npm install && \
    npx tsc

WORKDIR /app
COPY package.json ./

# Install rebrowser-playwright and its browser binaries
RUN npm install --no-cache && \
    npx rebrowser-playwright install-deps && \
    npx rebrowser-playwright install chromium firefox

COPY . .

ENV PORT=8080
ENV YTDLP=/usr/local/bin/yt-dlp
ENV NODE_ENV=production
EXPOSE 8080

# Start with xvfb-run to provide a virtual display for the browser
CMD ["sh", "-c", "xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24' sh -c 'node /pot-provider/server/build/main.js & yt-dlp -U >/dev/null 2>&1 || true; node server.js'"]
