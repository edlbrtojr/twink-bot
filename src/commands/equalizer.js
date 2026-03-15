const { useQueue } = require('discord-player');

const PRESET_MAP = {
  bassboost: 'bassboost',
  bassboost_low: 'bassboost_low',
  bassboost_high: 'bassboost_high',
  nightcore: 'nightcore',
  vaporwave: 'vaporwave',
  lofi: 'lofi',
  '8d': '8D',
  treble: 'treble',
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

    const preset = interaction.options.getString('preset', true);

    if (preset === 'off') {
      await queue.filters.ffmpeg.setFilters(false);
      return interaction.reply({
        embeds: [{
          color: 0x5865F2,
          title: 'Equalizer',
          description: 'Todos os filtros foram desativados.',
        }],
      });
    }

    const filterName = PRESET_MAP[preset];
    if (!filterName) {
      return interaction.reply({
        content: 'Preset inválido.',
        flags: 64,
      });
    }

    const isActive = queue.filters.ffmpeg.filters.includes(filterName);
    await queue.filters.ffmpeg.toggle([filterName]);

    const label = {
      bassboost: 'Bass Boost',
      bassboost_low: 'Bass Boost (Baixo)',
      bassboost_high: 'Bass Boost (Alto)',
      nightcore: 'Nightcore',
      vaporwave: 'Vaporwave',
      lofi: 'Lo-Fi',
      '8D': '8D',
      treble: 'Treble',
    }[filterName] || filterName;

    return interaction.reply({
      embeds: [{
        color: 0x57F287,
        title: 'Equalizer',
        description: isActive
          ? `**${label}** desativado.`
          : `**${label}** ativado.`,
      }],
    });
  },
};
