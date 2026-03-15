const { createAddedToQueueEmbed } = require('../utils/embeds');
const { MessageFlags } = require('discord.js');

/** Verifica se a query é uma URL do YouTube (vídeo ou playlist) */
function isYoutubeUrl(query) {
  if (!query || typeof query !== 'string') return false;
  const trimmed = query.trim();
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(trimmed);
}

/**
 * Prepara a query para o player: se não for URL, usa o prefixo ytsearch:
 * para forçar busca no YouTube por nome de música/artista.
 */
function prepareQuery(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return trimmed;
  if (isYoutubeUrl(trimmed)) return trimmed;
  // Força busca no YouTube quando for texto (nome, artista, etc.)
  return `ytsearch:${trimmed}`;
}

module.exports = {
  async execute(interaction, player) {
    await interaction.deferReply();

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({
        content: 'Entre em um canal de voz primeiro.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const rawQuery = interaction.options.getString('query', true);
    const query = prepareQuery(rawQuery);
    const guildId = interaction.guildId;

    const playOptions = {
      requestedBy: interaction.user,
      nodeOptions: {
        metadata: {
          channel: interaction.channel,
        },
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 60000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 60000,
      },
    };

    try {
      await player.play(voiceChannel, query, playOptions);

      const queue = player.nodes.get(guildId);
      if (!queue) {
        return interaction.editReply('Não foi possível criar a fila.');
      }

      const track = queue.currentTrack;
      if (track) {
        return interaction.editReply({
          embeds: [createAddedToQueueEmbed(track)],
        });
      }

      const added = queue.tracks.at(-1);
      if (added) {
        return interaction.editReply({
          embeds: [createAddedToQueueEmbed(added)],
        });
      }

      return interaction.editReply('Música adicionada à fila.');
    } catch (error) {
      console.error('Play error:', error);
      let message = 'Não foi possível reproduzir. ';
      if (error.message?.includes('No results') || error.message?.includes('Could not find')) {
        message += 'Nenhum resultado encontrado ou vídeo indisponível.';
      } else if (error.message?.includes('Sign in') || error.message?.includes('private')) {
        message += 'Vídeo privado ou restrito.';
      } else if (error.message?.includes('ffmpeg') || error.message?.includes('FFmpeg')) {
        message += 'FFmpeg não encontrado. Instale com: npm install @ffmpeg-installer/ffmpeg';
      } else {
        message += (error.message || 'Erro desconhecido.').slice(0, 500);
      }
      return interaction.editReply({ content: message.slice(0, 1900) });
    }
  },
};
