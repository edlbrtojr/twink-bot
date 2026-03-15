const { useQueue } = require('discord-player');

module.exports = {
  async execute(interaction, player) {
    const queue = useQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply({
        content: 'Não há nada tocando no momento.',
        ephemeral: true,
      });
    }

    if (queue.node.isPaused()) {
      return interaction.reply({
        content: 'A reprodução já está pausada.',
        ephemeral: true,
      });
    }

    queue.node.setPaused(true);
    return interaction.reply('Pausado.');
  },
};
