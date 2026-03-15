module.exports = {
  async execute(interaction, player) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: 'Entre em um canal de voz primeiro.',
        flags: 64,
      });
    }

    const url = interaction.options.getString('url', true);
    const guildId = interaction.guildId;

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return interaction.reply({
        content: 'Informe uma URL válida do YouTube.',
        flags: 64,
      });
    }

    if (!url.includes('list=') && !url.includes('/playlist')) {
      return interaction.reply({
        content: 'Para playlists, use uma URL no formato: https://www.youtube.com/playlist?list=ID_DA_PLAYLIST',
        flags: 64,
      });
    }

    await interaction.deferReply();

    try {
      await player.play(voiceChannel, url, {
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

      const count = queue.tracks.size;
      return interaction.editReply({
        embeds: [{
          color: 0x57F287,
          title: 'Playlist adicionada',
          description: `${count} música(s) adicionada(s) à fila.`,
          thumbnail: { url: 'https://www.youtube.com/s/desktop/7bb0a1e4/img/favicon_96x96.png' },
        }],
      });
    } catch (error) {
      console.error('Playlist error:', error);
      let message = 'Não foi possível carregar a playlist. ';
      if (error.message?.includes('No results') || error.message?.includes('Could not find')) {
        message += 'Playlist não encontrada ou indisponível.';
      } else if (error.message?.includes('Sign in') || error.message?.includes('private')) {
        message += 'Playlist privada ou restrita.';
      } else if (error.message?.includes('ffmpeg') || error.message?.includes('FFmpeg')) {
        message += 'FFmpeg não encontrado. Instale com: npm install @ffmpeg-installer/ffmpeg';
      } else {
        message += (error.message || 'Erro desconhecido.').slice(0, 500);
      }
      return interaction.editReply({ content: message.slice(0, 1900) });
    }
  },
};
