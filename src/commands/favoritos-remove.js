const favoritosDb = require('../db/favoritos');

module.exports = {
  async execute(interaction, player) {
    const userId = interaction.user.id;
    const indice = interaction.options.getInteger('indice', true);

    if (indice < 1) {
      return interaction.reply({
        content: 'O índice deve ser maior que 0.',
        flags: 64,
      });
    }

    const removed = favoritosDb.remove(userId, indice);
    if (!removed) {
      return interaction.reply({
        content: `Não foi possível remover. Verifique se o índice ${indice} existe. Use \`/favoritos list\` para ver seus favoritos.`,
        flags: 64,
      });
    }

    return interaction.reply({
      embeds: [{
        color: 0x57F287,
        title: 'Removido dos favoritos',
        description: `Música #${indice} removida.`,
      }],
    });
  },
};
