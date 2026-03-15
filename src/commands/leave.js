const { useQueue, getVoiceConnection } = require('discord-player');

module.exports = {
  async execute(interaction, player) {
    const queue = useQueue(interaction.guildId);

    if (!queue) {
      const connection = getVoiceConnection(interaction.guildId);
      if (connection) {
        connection.destroy();
      }
      return interaction.reply('Não estou em nenhum canal de voz.');
    }

    queue.delete();
    return interaction.reply('Saindo do canal de voz.');
  },
};
