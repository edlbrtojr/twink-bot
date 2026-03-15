const { QueueRepeatMode } = require('discord-player');

const LOOP_LABELS = {
  [QueueRepeatMode.OFF]: '',
  [QueueRepeatMode.TRACK]: ' 🔁 Faixa',
  [QueueRepeatMode.QUEUE]: ' 🔁 Fila',
  [QueueRepeatMode.AUTOPLAY]: ' ▶️ Autoplay',
};

function formatDuration(ms) {
  if (!ms || ms === 0) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function createNowPlayingEmbed(queue, track) {
  const progressBar = queue.node.createProgressBar?.({ timecodes: true, length: 15 });
  const loopLabel = LOOP_LABELS[queue.repeatMode] ?? '';

  const embed = {
    color: 0x5865F2,
    title: 'Tocando agora',
    description: `**${track.title}**${loopLabel}`,
    url: track.url,
    thumbnail: { url: track.thumbnail },
    fields: [],
    footer: { text: `Duração: ${track.duration}` },
  };

  if (progressBar) {
    embed.fields.push({
      name: '\u200b',
      value: `\`\`\`${progressBar}\`\`\``,
      inline: false,
    });
  }

  return embed;
}

function createQueueEmbed(tracks, currentTrack, page, totalPages, progressBar) {
  const TRACKS_PER_PAGE = 10;
  const start = page * TRACKS_PER_PAGE;
  const pageTracks = tracks.slice(start, start + TRACKS_PER_PAGE);

  let description = '';

  if (currentTrack) {
    description += `**Tocando agora:** ${currentTrack.title} (${formatDuration(currentTrack.durationMS)})\n`;
    if (progressBar) {
      description += `\`\`\`${progressBar}\`\`\`\n`;
    }
    description += '\n';
  }

  if (pageTracks.length === 0 && !currentTrack) {
    description = 'Fila vazia.';
  } else {
    pageTracks.forEach((track, i) => {
      const pos = start + i + 1;
      description += `\`${pos}.\` **${track.title}** (${formatDuration(track.durationMS)})\n`;
    });
  }

  return {
    color: 0x5865F2,
    title: 'Fila de reprodução',
    description: description || 'Fila vazia.',
    footer: {
      text: `Página ${page + 1}/${totalPages} • ${tracks.length + (currentTrack ? 1 : 0)} faixa(s)`,
    },
  };
}

function createAddedToQueueEmbed(track) {
  return {
    color: 0x57F287,
    title: 'Adicionado à fila',
    description: `**${track.title}**\n${formatDuration(track.durationMS)}`,
    url: track.url,
    thumbnail: { url: track.thumbnail },
  };
}

module.exports = {
  formatDuration,
  createNowPlayingEmbed,
  createQueueEmbed,
  createAddedToQueueEmbed,
};
