FROM node:20-slim

# Install Python, ffmpeg, curl, and unzip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install the latest Deno (JavaScript runtime for solving YouTube challenges)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install yt-dlp via pip with all optional dependencies
RUN pip3 install --break-system-packages "yt-dlp[default]"

WORKDIR /app

COPY package.json ./
RUN npm install

# Download and install the PO Token provider plugin
RUN mkdir -p /usr/local/lib/yt_dlp_plugins/extractor/ && \
    curl -L https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/latest/download/bgutil-ytdlp-pot-provider.zip -o /tmp/pot-provider.zip && \
    unzip /tmp/pot-provider.zip -d /usr/local/lib/yt_dlp_plugins/ && \
    rm /tmp/pot-provider.zip

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
