module.exports = {
  async execute(interaction, player) {
    const subcommand = interaction.options.getSubcommand();
    const handler = require(`./favoritos-${subcommand}.js`);
    return handler.execute(interaction, player);
  },
};
