const { useQueue, QueueRepeatMode } = require('discord-player');

const MODE_NAMES = {
  [QueueRepeatMode.OFF]: 'Desligado',
  [QueueRepeatMode.TRACK]: 'Faixa atual',
  [QueueRepeatMode.QUEUE]: 'Fila inteira',
  [QueueRepeatMode.AUTOPLAY]: 'Autoplay',
};

module.exports = {
  async execute(interaction, player) {
    const queue = useQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply({
        content: 'Não há nada tocando no momento.',
        flags: 64,
      });
    }

    const modo = interaction.options.getInteger('modo', true);
    queue.setRepeatMode(modo);

    const modeName = MODE_NAMES[modo] ?? 'Desconhecido';

    return interaction.reply({
      embeds: [{
        color: 0x5865F2,
        title: 'Modo de repetição',
        description: `Loop definido para: **${modeName}**`,
      }],
    });
  },
};
