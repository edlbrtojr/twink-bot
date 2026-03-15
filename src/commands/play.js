const { createAddedToQueueEmbed } = require('../utils/embeds');

module.exports = {
  async execute(interaction, player) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: 'Entre em um canal de voz primeiro.',
        ephemeral: true,
      });
    }

    const query = interaction.options.getString('query', true);
    const guildId = interaction.guildId;

    await interaction.deferReply();

    try {
      await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: {
            channel: interaction.channel,
          },
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 60000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 60000,
        },
      });

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
