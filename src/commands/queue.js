const { useQueue } = require('discord-player');
const { createQueueEmbed } = require('../utils/embeds');

const TRACKS_PER_PAGE = 10;

module.exports = {
  async execute(interaction, player) {
    const queue = useQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply({
        content: 'Não há fila no momento.',
        flags: 64,
      });
    }

    const tracks = queue.tracks.toArray();
    const currentTrack = queue.currentTrack;
    const totalPages = Math.max(1, Math.ceil(tracks.length / TRACKS_PER_PAGE));
    let page = 0;

    const pageOption = interaction.options?.getInteger('pagina');
    if (pageOption != null && pageOption >= 1 && pageOption <= totalPages) {
      page = pageOption - 1;
    }

    const progressBar = queue.node.createProgressBar?.({ timecodes: true, length: 15 });
    const embed = createQueueEmbed(tracks, currentTrack, page, totalPages, progressBar);

    return interaction.reply({ embeds: [embed] });
  },
};
