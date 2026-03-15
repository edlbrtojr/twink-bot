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

    const currentTrack = queue.currentTrack;
    queue.node.skip();

    if (currentTrack) {
      return interaction.reply(`Pulando: **${currentTrack.title}**`);
    }
    return interaction.reply('Pulando para a próxima faixa.');
  },
};
