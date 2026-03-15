const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.FAVORITOS_DB_PATH || path.join(process.cwd(), 'favoritos.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS favoritos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT,
    track_url TEXT NOT NULL,
    track_title TEXT NOT NULL,
    added_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_fav_user ON favoritos(user_id);
`);

function add(userId, guildId, trackUrl, trackTitle) {
  const stmt = db.prepare(`
    INSERT INTO favoritos (user_id, guild_id, track_url, track_title)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(userId, guildId || null, trackUrl, trackTitle);
  return result.lastInsertRowid;
}

function list(userId, limit = 50, offset = 0) {
  const stmt = db.prepare(`
    SELECT id, track_url, track_title, added_at
    FROM favoritos
    WHERE user_id = ?
    ORDER BY added_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset);
}

function count(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as total FROM favoritos WHERE user_id = ?');
  return stmt.get(userId).total;
}

function remove(userId, index) {
  const rows = list(userId, index, 0);
  const row = rows[index - 1];
  if (!row) return false;
  const stmt = db.prepare('DELETE FROM favoritos WHERE id = ? AND user_id = ?');
  stmt.run(row.id, userId);
  return true;
}

function getByIndex(userId, index) {
  const rows = list(userId, index, 0);
  return rows[index - 1] || null;
}

module.exports = {
  add,
  list,
  count,
  remove,
  getByIndex,
};
