const { useQueue } = require('discord-player');

module.exports = {
  async execute(interaction, player) {
    const queue = useQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply({
        content: 'Não há fila para parar.',
        flags: 64,
      });
    }

    queue.delete();
    return interaction.reply('Fila parada e limpa.');
  },
};
