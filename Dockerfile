FROM node:20-slim

# Dependências para better-sqlite3, ffmpeg e yt-dlp (streaming YouTube)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    make \
    g++ \
    ffmpeg \
    && pip3 install --break-system-packages yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Usar yt-dlp do sistema (pip) em vez do download do youtube-dl-exec
ENV YOUTUBE_DL_DIR=/usr/local/bin
ENV YOUTUBE_DL_SKIP_DOWNLOAD=1

# Copiar arquivos de dependências
COPY package.json package-lock.json ./

# Instalar dependências (sem devDependencies em produção)
RUN npm ci --omit=dev

# Copiar código fonte
COPY src ./src

# Diretório para persistência do banco de favoritos (monte volume em /data no EasyPanel)
RUN mkdir -p /data
ENV FAVORITOS_DB_PATH=/data/favoritos.db

# O bot não expõe porta HTTP - conecta ao Discord via WebSocket
CMD ["node", "src/index.js"]
