const { useQueue } = require('discord-player');
const favoritosDb = require('../db/favoritos');

module.exports = {
  async execute(interaction, player) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: 'Entre em um canal de voz primeiro.',
        flags: 64,
      });
    }

    const userId = interaction.user.id;
    const indice = interaction.options.getInteger('indice', true);

    if (indice < 1) {
      return interaction.reply({
        content: 'O índice deve ser maior que 0.',
        flags: 64,
      });
    }

    const fav = favoritosDb.getByIndex(userId, indice);
    if (!fav) {
      return interaction.reply({
        content: `Favorito #${indice} não encontrado. Use \`/favoritos list\` para ver seus favoritos.`,
        flags: 64,
      });
    }

    await interaction.deferReply();

    try {
      await player.play(voiceChannel, fav.track_url, {
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

      return interaction.editReply({
        embeds: [{
          color: 0x57F287,
          title: 'Tocando dos favoritos',
          description: `**${fav.track_title}**`,
        }],
      });
    } catch (error) {
      console.error('Favoritos play error:', error);
      return interaction.editReply({
        content: `Erro ao reproduzir: ${error.message?.slice(0, 300) || 'Erro desconhecido'}`,
      });
    }
  },
};
