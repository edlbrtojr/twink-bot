require('dotenv').config();

// Usar FFmpeg do pacote @ffmpeg-installer/ffmpeg (prioridade)
try {
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  const { FFmpeg } = require('@discord-player/ffmpeg');
  FFmpeg.sources.unshift({ name: ffmpegPath, module: false });
} catch (_) {}

const { Client, GatewayIntentBits, MessageFlags } = require('discord.js');
const { Player } = require('discord-player');
const { YoutubeiExtractor, Log } = require('discord-player-youtubei');

// Suprime avisos do youtubei.js (ex: "Unable to find matching run for attachment run")
// que aparecem ao tocar links de mix/radio do YouTube - não afetam a reprodução
if (Log?.setLevel && Log?.Level) {
  Log.setLevel(Log.Level.ERROR);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

const player = new Player(client);

const UPDATE_INTERVAL_MS = 5000; // Atualiza a barra de progresso a cada 5 segundos

function clearNowPlayingInterval(queue) {
  const metadata = queue?.metadata;
  if (metadata?.nowPlayingIntervalId) {
    clearInterval(metadata.nowPlayingIntervalId);
    metadata.nowPlayingIntervalId = null;
  }
}

async function main() {
  // Verificar yt-dlp e conectividade com YouTube no startup
  try {
    const { execSync } = require('child_process');
    const version = execSync('yt-dlp --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    console.log('[Startup] yt-dlp:', version);
    // Teste rápido: consegue obter URL de um vídeo?
    execSync('yt-dlp -g --no-playlist "https://www.youtube.com/watch?v=dQw4w9WgXcQ"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 });
    console.log('[Startup] YouTube: OK');
  } catch (e) {
    console.warn('[Startup]', e.message?.split('\n')[0] || 'verificação falhou');
  }

  // useYoutubeDL + createStream: URL direta evita EPIPE/pipe em Docker
  const ytdlExec = require('youtube-dl-exec');
  const { Readable } = require('stream');

  function extractVideoId(url) {
    const match = url?.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    return match ? match[1] : null;
  }

  async function createYtDlpStream(track, extractor) {
    const videoId = extractVideoId(track.url);
    if (!videoId) return undefined;
    const videoUrl = `https://youtu.be/${videoId}`;
    const format = track.live ? 'best[height<=360]' : 'worstaudio';
    try {
      const streamUrl = await ytdlExec(videoUrl, {
        format,
        getUrl: true,
        noPlaylist: true,
        noWarnings: true,
        cookies: extractor.options?.cookie,
      });
      if (!streamUrl || typeof streamUrl !== 'string') return undefined;
      const res = await fetch(streamUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok || !res.body) return undefined;
      return Readable.fromWeb(res.body);
    } catch (e) {
      if (extractor.options?.logLevel === 'ALL') console.error('[yt-dlp]', e);
      return undefined;
    }
  }

  await player.extractors.register(YoutubeiExtractor, {
    useYoutubeDL: true,
    createStream: createYtDlpStream,
    streamOptions: { highWaterMark: 1 << 24 },
  });

  player.events.on('playerStart', (queue, track) => {
    console.log('[Player] Iniciando:', track?.title || '?');
    const metadata = queue.metadata;
    if (!metadata?.channel) return;

    metadata.lastTrackStartTime = Date.now();
    clearNowPlayingInterval(queue);

    const { createNowPlayingEmbed } = require('./utils/embeds');
    const embed = createNowPlayingEmbed(queue, track);
    metadata.channel.send({ embeds: [embed] }).then((message) => {
      const intervalId = setInterval(async () => {
        const currentTrack = queue.currentTrack;
        if (!currentTrack || currentTrack.id !== track.id) {
          clearNowPlayingInterval(queue);
          return;
        }
        const updatedEmbed = createNowPlayingEmbed(queue, track);
        await message.edit({ embeds: [updatedEmbed] }).catch(() => {});
      }, UPDATE_INTERVAL_MS);
      metadata.nowPlayingIntervalId = intervalId;
    }).catch(() => {});
  });

  player.events.on('playerFinish', (queue) => clearNowPlayingInterval(queue));
  player.events.on('playerSkip', (queue) => clearNowPlayingInterval(queue));
  player.events.on('disconnect', (queue) => clearNowPlayingInterval(queue));

  player.events.on('error', (queue, error) => {
    console.error('[Player] ERRO:', error?.message || String(error));
    if (error?.stack) console.error(error.stack);
    const metadata = queue?.metadata;
    if (metadata?.channel) {
      metadata.channel.send(`Erro ao reproduzir: ${error.message}`).catch(() => {});
    }
  });

  player.events.on('playerError', (queue, error, track) => {
    console.error('[Player] ERRO DE REPRODUÇÃO:', track?.title, '|', error?.message || String(error));
    if (error?.stack) console.error(error.stack);
    const metadata = queue?.metadata;
    if (metadata?.channel) {
      metadata.channel.send(`Erro ao reproduzir: ${error.message}`).catch(() => {});
    }
  });

  player.events.on('emptyQueue', (queue) => {
    clearNowPlayingInterval(queue);
    const metadata = queue.metadata;
    if (!metadata?.channel) return;

    const playedFor = metadata.lastTrackStartTime ? (Date.now() - metadata.lastTrackStartTime) / 1000 : 0;
    console.log('[Player] Fila vazia. Tocou por', playedFor.toFixed(1), 'segundos');
    const msg = playedFor < 30
      ? 'A reprodução foi interrompida. Verifique se o servidor tem acesso à internet e FFmpeg instalado. Use `/leave` para eu sair.'
      : 'Fila vazia. Use `/leave` para eu sair do canal.';
    metadata.channel.send(msg).catch(() => {});
  });

  client.once('clientReady', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    await registerCommands();
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands?.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, player);
    } catch (error) {
      console.error(`Erro ao executar ${interaction.commandName}:`, error);
      const msg = `Erro ao executar comando: ${error.message}`;
      const reply = { content: msg.length > 1900 ? msg.slice(0, 1900) + '...' : msg, flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  });

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('DISCORD_TOKEN não definido. Crie um arquivo .env com DISCORD_TOKEN=seu_token');
    process.exit(1);
  }

  await client.login(token);
}

async function registerCommands() {
  const commands = [
    {
      name: 'play',
      description: 'Toca um vídeo ou busca no YouTube',
      options: [{
        name: 'query',
        type: 3,
        description: 'URL do YouTube ou termo de busca',
        required: true,
      }],
    },
    {
      name: 'playlist',
      description: 'Adiciona uma playlist do YouTube à fila',
      options: [{
        name: 'url',
        type: 3,
        description: 'URL da playlist do YouTube',
        required: true,
      }],
    },
    { name: 'pause', description: 'Pausa a reprodução' },
    { name: 'resume', description: 'Retoma a reprodução' },
    { name: 'skip', description: 'Pula para a próxima faixa' },
    { name: 'stop', description: 'Para e limpa a fila' },
    {
      name: 'queue',
      description: 'Mostra a fila atual',
      options: [{
        name: 'pagina',
        type: 4,
        description: 'Número da página (1, 2, 3...)',
        required: false,
      }],
    },
    { name: 'leave', description: 'Sai do canal de voz' },
    { name: 'shuffle', description: 'Embaralha as músicas da fila' },
    {
      name: 'loop',
      description: 'Define o modo de repetição (faixa, fila ou autoplay)',
      options: [{
        name: 'modo',
        type: 4,
        description: 'Modo de repetição',
        required: true,
        choices: [
          { name: 'Desligado', value: 0 },
          { name: 'Faixa atual', value: 1 },
          { name: 'Fila inteira', value: 2 },
          { name: 'Autoplay', value: 3 },
        ],
      }],
    },
    {
      name: 'equalizer',
      description: 'Aplica um preset de equalizer (bassboost, nightcore, etc.)',
      options: [{
        name: 'preset',
        type: 3,
        description: 'Preset de áudio',
        required: true,
        choices: [
          { name: 'Desligado', value: 'off' },
          { name: 'Bass Boost', value: 'bassboost' },
          { name: 'Bass Boost (Baixo)', value: 'bassboost_low' },
          { name: 'Bass Boost (Alto)', value: 'bassboost_high' },
          { name: 'Nightcore', value: 'nightcore' },
          { name: 'Vaporwave', value: 'vaporwave' },
          { name: 'Lo-Fi', value: 'lofi' },
          { name: '8D', value: '8d' },
          { name: 'Treble', value: 'treble' },
        ],
      }],
    },
    {
      name: 'lyrics',
      description: 'Mostra a letra da música atual ou busca por termo',
      options: [{
        name: 'busca',
        type: 3,
        description: 'Termo de busca (ex: "Artista - Música"). Omita para usar a faixa atual.',
        required: false,
      }],
    },
    {
      name: 'favoritos',
      description: 'Gerencia seus favoritos',
      options: [
        {
          type: 1,
          name: 'add',
          description: 'Adiciona uma música aos favoritos',
          options: [{
            name: 'url',
            type: 3,
            description: 'URL do YouTube (opcional - usa a faixa atual)',
            required: false,
          }],
        },
        {
          type: 1,
          name: 'list',
          description: 'Lista seus favoritos',
          options: [{
            name: 'pagina',
            type: 4,
            description: 'Número da página',
            required: false,
          }],
        },
        {
          type: 1,
          name: 'remove',
          description: 'Remove um favorito por índice',
          options: [{
            name: 'indice',
            type: 4,
            description: 'Número do favorito (1, 2, 3...)',
            required: true,
          }],
        },
        {
          type: 1,
          name: 'play',
          description: 'Toca um favorito',
          options: [{
            name: 'indice',
            type: 4,
            description: 'Número do favorito',
            required: true,
          }],
        },
      ],
    },
  ];

  await client.application.commands.set(commands);
  client.commands = new Map(commands.map(c => [c.name, require(`./commands/${c.name}.js`)]));
  console.log('Comandos slash registrados.');
}

main().catch(console.error);
