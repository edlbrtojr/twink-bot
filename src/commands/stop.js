const { useQueue } = require('discord-player');

module.exports = {
  async execute(interaction, player) {
    const queue = useQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply({
        content: 'Não há fila para parar.',
        ephemeral: true,
      });
    }

    queue.delete();
    return interaction.reply('Fila parada e limpa.');
  },
};
