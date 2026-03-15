FROM node:20-slim

# Dependências para better-sqlite3, ffmpeg e yt-dlp (streaming YouTube)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    make \
    g++ \
    ffmpeg \
    && pip3 install --break-system-packages --upgrade yt-dlp \
    && yt-dlp --version \
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

# Diretório para persistência (banco de favoritos + cookies do YouTube)
# Monte volume em /data no EasyPanel
RUN mkdir -p /data
ENV FAVORITOS_DB_PATH=/data/favoritos.db
# Para evitar bloqueio do YouTube em IPs de datacenter, exporte cookies do
# navegador (extensão "Get cookies.txt LOCALLY") e coloque em /data/cookies.txt
ENV YT_COOKIES_PATH=/data/cookies.txt

# O bot não expõe porta HTTP - conecta ao Discord via WebSocket
CMD ["node", "src/index.js"]
