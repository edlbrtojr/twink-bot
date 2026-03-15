FROM node:20-slim

# Dependências para better-sqlite3 (compilação nativa) e ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

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
