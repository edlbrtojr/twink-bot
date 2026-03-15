# Discord Music Bot

Bot do Discord para reproduzir áudio de vídeos e playlists do YouTube em canais de voz.

## Pré-requisitos

- **Node.js 18+**
- **FFmpeg** instalado e no PATH do sistema
- **Aplicação Discord** no [Discord Developer Portal](https://discord.com/developers/applications)

## Instalação

1. Clone ou baixe o projeto e instale as dependências:

```bash
npm install
```

2. Crie um arquivo `.env` baseado no `.env.example`:

```bash
cp .env.example .env
```

3. Edite o `.env` e adicione suas credenciais:

```
DISCORD_TOKEN=seu_token_do_bot
GENIUS_API_KEY=seu_token_genius
```

O `GENIUS_API_KEY` é opcional e só é necessário para o comando `/lyrics`. Obtenha em [genius.com/developers](https://genius.com/developers).

4. No Discord Developer Portal, configure seu bot:
   - Em **Bot**, copie o token
   - Em **OAuth2 > URL Generator**, selecione os scopes: `bot`, `applications.commands`
   - Selecione as permissões: Connect, Speak, Send Messages, Use Application Commands
   - Use a URL gerada para convidar o bot ao seu servidor

## Executando

```bash
node src/index.js
```

Ou com hot reload (desenvolvimento):

```bash
npx nodemon src/index.js
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `/play <url ou busca>` | Toca um vídeo ou busca no YouTube |
| `/playlist <url>` | Adiciona uma playlist do YouTube à fila |
| `/pause` | Pausa a reprodução |
| `/resume` | Retoma a reprodução |
| `/skip` | Pula para a próxima faixa |
| `/stop` | Para e limpa a fila |
| `/queue [pagina]` | Mostra a fila atual (com paginação) |
| `/leave` | Sai do canal de voz |
| `/shuffle` | Embaralha as músicas da fila |
| `/loop <modo>` | Define repetição: desligado, faixa, fila ou autoplay |
| `/equalizer <preset>` | Aplica preset de áudio (bassboost, nightcore, etc.) |
| `/lyrics [busca]` | Mostra a letra da música atual ou busca por termo |
| `/favoritos add [url]` | Adiciona música aos favoritos |
| `/favoritos list [pagina]` | Lista seus favoritos |
| `/favoritos remove <indice>` | Remove um favorito |
| `/favoritos play <indice>` | Toca um favorito |

## Tecnologias

- [discord.js](https://discord.js.org/) - Framework para bots Discord
- [discord-player](https://discord-player.js.org/) - Player de música
- [discord-player-youtubei](https://github.com/retrouser955/discord-player-youtubei) - Extractor para YouTube
- [genius-lyrics-api](https://www.npmjs.com/package/genius-lyrics-api) - Letras via Genius
- [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3) - Banco de dados para favoritos

## Deploy no EasyPanel

O projeto inclui `Dockerfile` e workflow do GitHub Actions para deploy automático.

### 1. Configurar no EasyPanel

1. Crie um novo **App** no EasyPanel
2. **Source**: selecione GitHub e conecte o repositório (ou use o token em Settings > Github)
3. **Build**: o Dockerfile será detectado automaticamente
4. **Variáveis de ambiente**: adicione `DISCORD_TOKEN` e `GENIUS_API_KEY` (opcional)
5. **Mounts**: adicione um Volume em `/data` para persistir o banco de favoritos
6. **Réplicas**: use **apenas 1 réplica**. Múltiplas instâncias causam "Unknown interaction" (erro 10062)
7. Ative **Auto Deploy** se quiser deploy nativo do EasyPanel, ou use o GitHub Actions abaixo

### 2. GitHub Actions (deploy automático)

Para deploy automático a cada push em `main` ou `master`:

1. No EasyPanel, abra o serviço e copie a URL do **Deploy Webhook**
2. No GitHub: **Settings > Secrets and variables > Actions**
3. Crie o secret `EASYPANEL_DEPLOY_WEBHOOK` com a URL do webhook
4. A cada push em `main`/`master`, o workflow acionará o deploy no EasyPanel

### Volume para favoritos

O banco de favoritos usa `/data/favoritos.db`. Monte um volume em `/data` no EasyPanel para persistir os dados entre deploys.

## Solução de problemas

- **FFmpeg não encontrado**: Instale o FFmpeg e adicione ao PATH, ou defina a variável `FFMPEG_PATH`
- **Vídeo indisponível**: Alguns vídeos podem ser privados ou restritos
- **Bot não entra no canal**: Verifique se o bot tem permissões de Connect e Speak
- **Unknown interaction (10062)**: Reduza para 1 réplica no EasyPanel (Deploy settings)
# twink-bot
