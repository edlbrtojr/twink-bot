const { useQueue } = require('discord-player');

module.exports = {
  async execute(interaction, player) {
    const queue = useQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply({
        content: 'Não há fila no momento.',
        flags: 64,
      });
    }

    if (queue.tracks.size < 2) {
      return interaction.reply({
        content: 'É necessário ter pelo menos 2 músicas na fila para embaralhar.',
        flags: 64,
      });
    }

    queue.tracks.shuffle();

    return interaction.reply({
      embeds: [{
        color: 0x57F287,
        title: 'Fila embaralhada',
        description: `${queue.tracks.size} música(s) foram embaralhadas.`,
      }],
    });
  },
};
