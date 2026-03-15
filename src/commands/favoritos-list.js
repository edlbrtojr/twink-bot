const favoritosDb = require('../db/favoritos');

const PER_PAGE = 10;

module.exports = {
  async execute(interaction, player) {
    const userId = interaction.user.id;
    const page = Math.max(1, interaction.options.getInteger('pagina') ?? 1);
    const offset = (page - 1) * PER_PAGE;

    const total = favoritosDb.count(userId);
    if (total === 0) {
      return interaction.reply({
        content: 'Você não tem músicas nos favoritos. Use `/favoritos add` para adicionar.',
        flags: 64,
      });
    }

    const rows = favoritosDb.list(userId, PER_PAGE, offset);
    const totalPages = Math.ceil(total / PER_PAGE);

    let description = '';
    rows.forEach((row, i) => {
      const pos = offset + i + 1;
      const title = row.track_title.length > 50 ? row.track_title.slice(0, 47) + '...' : row.track_title;
      description += `\`${pos}.\` **${title}**\n`;
    });

    return interaction.reply({
      embeds: [{
        color: 0x5865F2,
        title: 'Seus favoritos',
        description: description || 'Nenhum favorito.',
        footer: { text: `Página ${page}/${totalPages} • ${total} música(s)` },
      }],
    });
  },
};
