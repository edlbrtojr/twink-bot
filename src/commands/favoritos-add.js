const { useQueue } = require('discord-player');
const favoritosDb = require('../db/favoritos');

module.exports = {
  async execute(interaction, player) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const url = interaction.options.getString('url');

    let trackUrl;
    let trackTitle;

    if (url) {
      trackUrl = url;
      trackTitle = url.length > 100 ? url.slice(0, 97) + '...' : url;
    } else {
      const queue = useQueue(guildId);
      const track = queue?.currentTrack ?? queue?.tracks.at(-1);
      if (!track) {
        return interaction.reply({
          content: 'Não há música tocando ou na fila. Informe uma URL ou adicione uma música primeiro.',
          ephemeral: true,
        });
      }
      trackUrl = track.url;
      trackTitle = track.title;
    }

    if (!trackUrl.includes('youtube.com') && !trackUrl.includes('youtu.be')) {
      return interaction.reply({
        content: 'Informe uma URL válida do YouTube.',
        ephemeral: true,
      });
    }

    favoritosDb.add(userId, guildId, trackUrl, trackTitle);

    return interaction.reply({
      embeds: [{
        color: 0x57F287,
        title: 'Adicionado aos favoritos',
        description: `**${trackTitle}**`,
      }],
    });
  },
};
