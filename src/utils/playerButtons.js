const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PREFIX = 'music_';

/**
 * Cria os botões de controle do player (play/pause, shuffle, ver fila).
 * @param {string} guildId - ID do servidor
 * @param {boolean} isPaused - Se a reprodução está pausada
 * @returns {ActionRowBuilder[]}
 */
function createPlayerButtons(guildId, isPaused) {
  const playPause = new ButtonBuilder()
    .setCustomId(`${PREFIX}playpause_${guildId}`)
    .setLabel(isPaused ? 'Retomar' : 'Pausar')
    .setEmoji(isPaused ? '▶️' : '⏸️')
    .setStyle(ButtonStyle.Primary);

  const shuffle = new ButtonBuilder()
    .setCustomId(`${PREFIX}shuffle_${guildId}`)
    .setLabel('Embaralhar')
    .setEmoji('🔀')
    .setStyle(ButtonStyle.Secondary);

  const queue = new ButtonBuilder()
    .setCustomId(`${PREFIX}queue_${guildId}`)
    .setLabel('Ver fila')
    .setEmoji('📋')
    .setStyle(ButtonStyle.Secondary);

  return [new ActionRowBuilder().addComponents(playPause, shuffle, queue)];
}

/**
 * Verifica se o customId é de um botão do player.
 */
function isPlayerButton(customId) {
  return typeof customId === 'string' && customId.startsWith(PREFIX);
}

/**
 * Extrai a ação e o guildId do customId.
 * @returns {{ action: string, guildId: string } | null}
 */
function parsePlayerButtonId(customId) {
  if (!isPlayerButton(customId)) return null;
  const parts = customId.slice(PREFIX.length).split('_');
  if (parts.length < 2) return null;
  return { action: parts[0], guildId: parts.slice(1).join('_') };
}

module.exports = {
  PREFIX,
  createPlayerButtons,
  isPlayerButton,
  parsePlayerButtonId,
};
