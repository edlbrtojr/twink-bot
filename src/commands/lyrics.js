const { useQueue } = require('discord-player');
const { getLyrics } = require('genius-lyrics-api');

const MAX_LYRICS_LENGTH = 3900;

function parseTrackTitle(title) {
  const separators = [' - ', ' – ', ' — ', ' | '];
  for (const sep of separators) {
    const idx = title.indexOf(sep);
    if (idx > 0) {
      return {
        artist: title.slice(0, idx).trim(),
        title: title.slice(idx + sep.length).trim(),
      };
    }
  }
  return { artist: '', title: title.trim() };
}

function truncateLyrics(text) {
  if (!text || text.length <= MAX_LYRICS_LENGTH) return text;
  return text.slice(0, MAX_LYRICS_LENGTH) + '\n\n[... letra truncada]';
}

module.exports = {
  async execute(interaction, player) {
    const apiKey = process.env.GENIUS_API_KEY;
    if (!apiKey) {
      return interaction.reply({
        content: 'A API do Genius não está configurada. Defina GENIUS_API_KEY no .env',
        flags: 64,
      });
    }

    let title = '';
    let artist = '';

    const busca = interaction.options.getString('busca');
    const queue = useQueue(interaction.guildId);
    const currentTrack = queue?.currentTrack;

    if (busca) {
      const parsed = parseTrackTitle(busca);
      title = parsed.title || busca;
      artist = parsed.artist;
    } else if (currentTrack) {
      const parsed = parseTrackTitle(currentTrack.title);
      title = parsed.title || currentTrack.title;
      artist = parsed.artist;
    } else {
      return interaction.reply({
        content: 'Não há música tocando. Use a opção `busca` para procurar letras.',
        flags: 64,
      });
    }

    await interaction.deferReply();

    try {
      const lyrics = await getLyrics({
        apiKey,
        title,
        artist,
        optimizeQuery: true,
      });

      if (!lyrics) {
        return interaction.editReply({
          content: `Nenhuma letra encontrada para "${artist ? artist + ' - ' : ''}${title}".`,
        });
      }

      const displayLyrics = truncateLyrics(lyrics);

      return interaction.editReply({
        embeds: [{
          color: 0x5865F2,
          title: artist ? `${artist} - ${title}` : title,
          description: `\`\`\`\n${displayLyrics}\n\`\`\``,
          footer: { text: 'Fonte: Genius' },
        }],
      });
    } catch (error) {
      console.error('Lyrics error:', error);
      return interaction.editReply({
        content: `Erro ao buscar letras: ${error.message?.slice(0, 200) || 'Erro desconhecido'}`,
      });
    }
  },
};
