const { useQueue, QueueRepeatMode } = require('discord-player');

module.exports = {
  async execute(interaction, player) {
    const queue = useQueue(interaction.guildId);

    if (!queue || !queue.currentTrack) {
      return interaction.reply({
        content: 'Não há nada tocando no momento.',
        flags: 64,
      });
    }

    const isAutoplay = queue.repeatMode === QueueRepeatMode.AUTOPLAY;

    if (isAutoplay) {
      queue.setRepeatMode(QueueRepeatMode.OFF);
      return interaction.reply({
        embeds: [{
          color: 0xED4245,
          title: '📻 Autoplay desativado',
          description: 'O modo rádio foi desativado. A reprodução vai parar quando a fila acabar.',
        }],
      });
    }

    queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
    return interaction.reply({
      embeds: [{
        color: 0x57F287,
        title: '📻 Autoplay ativado',
        description: 'Modo rádio ligado! Quando a fila acabar, vou tocar músicas similares automaticamente.',
      }],
    });
  },
};
