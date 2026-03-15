require('dotenv').config();

// Usar FFmpeg do pacote @ffmpeg-installer/ffmpeg (prioridade)
try {
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  const { FFmpeg } = require('@discord-player/ffmpeg');
  FFmpeg.sources.unshift({ name: ffmpegPath, module: false });
} catch (_) {}

const { Client, GatewayIntentBits, MessageFlags } = require('discord.js');
const { createPlayerButtons, isPlayerButton, parsePlayerButtonId } = require('./utils/playerButtons');
const { Player, QueueRepeatMode } = require('discord-player');
const { YoutubeiExtractor, Log } = require('discord-player-youtubei');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');

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
  const fs = require('fs');
  const ytCookiesPath = process.env.YT_COOKIES_PATH || '';

  // Lê arquivo de cookies Netscape e retorna string "name=val; name2=val2" para o youtubei
  function parseCookiesFile(filePath) {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf8');
      const cookies = [];
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const parts = trimmed.split('\t');
        if (parts.length >= 7) {
          cookies.push(`${parts[5]}=${parts[6]}`);
        }
      }
      return cookies.length > 0 ? cookies.join('; ') : null;
    } catch {
      return null;
    }
  }

  const cookieString = parseCookiesFile(ytCookiesPath);
  if (cookieString) {
    console.log('[Startup] YouTube cookies carregados de', ytCookiesPath);
  } else if (ytCookiesPath) {
    console.warn('[Startup] Arquivo de cookies não encontrado:', ytCookiesPath);
  } else {
    console.warn('[Startup] YT_COOKIES_PATH não definido — YouTube pode bloquear IPs de datacenter');
  }

  // Verificar yt-dlp e conectividade com YouTube no startup
  try {
    const { execSync } = require('child_process');
    const version = execSync('yt-dlp --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    console.log('[Startup] yt-dlp:', version);
    const cookiesArg = ytCookiesPath && fs.existsSync(ytCookiesPath) ? `--cookies "${ytCookiesPath}"` : '';
    execSync(`yt-dlp -g --no-playlist --js-runtimes node ${cookiesArg} "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
    console.log('[Startup] YouTube: OK');
  } catch (e) {
    const stderr = e.stderr?.toString().trim();
    const stdout = e.stdout?.toString().trim();
    const msg = e.message || '';
    console.warn('[Startup] yt-dlp teste falhou');
    if (stderr) console.warn('[Startup] stderr:', stderr);
    if (stdout) console.warn('[Startup] stdout:', stdout);
    if (!stderr && !stdout) console.warn('[Startup] message:', msg.slice(0, 500));
  }

  function createYtDlpStream(query) {
    const isUrl = /^https?:\/\//i.test(query);
    const target = isUrl ? query : `ytsearch:${query}`;

    const args = [
      '-f', 'bestaudio[ext=webm]/bestaudio/best',
      '-o', '-',
      '--no-playlist',
      '--no-warnings',
      '--no-progress',
    ];
    if (ytCookiesPath && fs.existsSync(ytCookiesPath)) {
      args.push('--cookies', ytCookiesPath);
    }
    args.push(target);

    const ytdlp = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stream = new PassThrough({ highWaterMark: 1 << 24 });

    ytdlp.stdout.pipe(stream);

    ytdlp.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.warn('[yt-dlp stream]', msg);
    });

    ytdlp.on('error', (err) => {
      console.error('[yt-dlp stream] Erro do processo:', err.message);
      if (!stream.destroyed) stream.destroy(err);
    });

    ytdlp.on('close', (code) => {
      if (code && code !== 0) {
        console.warn('[yt-dlp stream] Processo encerrou com código:', code);
      }
      if (!stream.destroyed) stream.end();
    });

    stream.on('close', () => {
      if (!ytdlp.killed) ytdlp.kill('SIGTERM');
    });

    return stream;
  }

  const extractorOptions = {
    createStream: createYtDlpStream,
    generateWithPoToken: true,
    streamOptions: {
      useClient: 'WEB',
      highWaterMark: 1 << 24,
    },
  };
  if (cookieString) {
    extractorOptions.cookie = cookieString;
  }
  await player.extractors.register(YoutubeiExtractor, extractorOptions);

  player.events.on('playerStart', (queue, track) => {
    console.log('[Player] Iniciando:', track?.title || '?');
    const metadata = queue.metadata;
    if (!metadata?.channel) return;

    metadata.lastTrackStartTime = Date.now();
    clearNowPlayingInterval(queue);

    const { createNowPlayingEmbed } = require('./utils/embeds');
    const embed = createNowPlayingEmbed(queue, track);
    const isAutoplay = queue.repeatMode === QueueRepeatMode.AUTOPLAY;
    const components = createPlayerButtons(queue.guild.id, queue.node.isPaused(), isAutoplay);
    metadata.channel.send({ embeds: [embed], components }).then((message) => {
      const intervalId = setInterval(async () => {
        const currentTrack = queue.currentTrack;
        if (!currentTrack || currentTrack.id !== track.id) {
          clearNowPlayingInterval(queue);
          return;
        }
        const updatedEmbed = createNowPlayingEmbed(queue, track);
        const autoplay = queue.repeatMode === QueueRepeatMode.AUTOPLAY;
        const updatedComponents = createPlayerButtons(queue.guild.id, queue.node.isPaused(), autoplay);
        await message.edit({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => {});
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

    if (queue.repeatMode === QueueRepeatMode.AUTOPLAY) {
      console.log('[Player] Fila vazia — autoplay ativo, buscando faixa similar...');
      return;
    }

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
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === 'play') {
        const focused = interaction.options.getFocused();
        const FALLBACK_SUGGESTIONS = [
          { name: 'The Weeknd - Blinding Lights', value: 'The Weeknd - Blinding Lights' },
          { name: 'Ed Sheeran - Shape of You', value: 'Ed Sheeran - Shape of You' },
          { name: 'Imagine Dragons - Believer', value: 'Imagine Dragons - Believer' },
          { name: 'Coldplay - Yellow', value: 'Coldplay - Yellow' },
          { name: 'Queen - Bohemian Rhapsody', value: 'Queen - Bohemian Rhapsody' },
          { name: 'Dua Lipa - Levitating', value: 'Dua Lipa - Levitating' },
        ];
        if (focused.length < 2) {
          const filtered = focused.length > 0
            ? FALLBACK_SUGGESTIONS.filter(s =>
                s.name.toLowerCase().includes(focused.toLowerCase()) ||
                s.value.toLowerCase().includes(focused.toLowerCase())
              ).slice(0, 25)
            : FALLBACK_SUGGESTIONS.slice(0, 6);
          return interaction.respond(filtered).catch(() => {});
        }
        try {
          const searchQuery = `ytsearch:${focused}`;
          const result = await player.search(searchQuery, {
            requestedBy: interaction.user,
            searchEngine: 'youtubeSearch',
          });
          const suggestions = (result.tracks || []).slice(0, 10).map((t) => ({
            name: t.title.length > 100 ? `${t.title.slice(0, 97)}...` : t.title,
            value: t.url,
          }));
          await interaction.respond(suggestions.length > 0 ? suggestions : FALLBACK_SUGGESTIONS.slice(0, 5)).catch(() => {});
        } catch {
          const filtered = FALLBACK_SUGGESTIONS.filter(s =>
            s.name.toLowerCase().includes(focused.toLowerCase()) ||
            s.value.toLowerCase().includes(focused.toLowerCase())
          ).slice(0, 10);
          await interaction.respond(filtered.length > 0 ? filtered : FALLBACK_SUGGESTIONS.slice(0, 5)).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isButton() && isPlayerButton(interaction.customId)) {
      const parsed = parsePlayerButtonId(interaction.customId);
      if (!parsed) return;
      const { action, guildId } = parsed;
      const queue = player.nodes.get(guildId);

      if (action === 'queue') {
        if (!queue) {
          return interaction.reply({ content: 'Não há fila no momento.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        const { createQueueEmbed } = require('./utils/embeds');
        const TRACKS_PER_PAGE = 10;
        const tracks = queue.tracks.toArray();
        const currentTrack = queue.currentTrack;
        const totalPages = Math.max(1, Math.ceil(tracks.length / TRACKS_PER_PAGE));
        const progressBar = queue.node.createProgressBar?.({ timecodes: true, length: 15 });
        const embed = createQueueEmbed(tracks, currentTrack, 0, totalPages, progressBar);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      if (!queue) {
        return interaction.reply({ content: 'Não há nada tocando no momento.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel || voiceChannel.id !== queue.channel?.id) {
        return interaction.reply({ content: 'Entre no mesmo canal de voz para usar os controles.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      if (action === 'playpause') {
        const isPaused = queue.node.isPaused();
        if (isPaused) {
          queue.node.setPaused(false);
          interaction.reply({ content: '▶️ Retomando a reprodução.', flags: MessageFlags.Ephemeral }).catch(() => {});
        } else {
          queue.node.setPaused(true);
          interaction.reply({ content: '⏸️ Pausado.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
      }

      if (action === 'shuffle') {
        if (queue.tracks.size < 2) {
          return interaction.reply({ content: 'É necessário ter pelo menos 2 músicas na fila para embaralhar.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        queue.tracks.shuffle();
        return interaction.reply({ content: '🔀 Fila embaralhada!', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      if (action === 'autoplay') {
        const isAutoplay = queue.repeatMode === QueueRepeatMode.AUTOPLAY;
        queue.setRepeatMode(isAutoplay ? QueueRepeatMode.OFF : QueueRepeatMode.AUTOPLAY);
        const msg = isAutoplay
          ? '📻 Autoplay desativado.'
          : '📻 Autoplay ativado! Vou tocar músicas similares quando a fila acabar.';
        return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      return;
    }

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
      description: 'Toca música por nome, artista ou link do YouTube',
      options: [{
        name: 'query',
        type: 3,
        description: 'Nome da música, artista (ex: "The Weeknd - Blinding Lights") ou URL do YouTube',
        required: true,
        autocomplete: true,
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
    { name: 'autoplay', description: 'Ativa/desativa o modo rádio (toca músicas similares quando a fila acabar)' },
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
