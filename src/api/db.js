const sqlite3 = require('sqlite3')
const path = require('path')
const fs = require('fs')

const DATA_DIR = process.env.DATA_DIR || './data'
fs.mkdirSync(DATA_DIR, { recursive: true })

const raw = new sqlite3.Database(path.join(DATA_DIR, 'dashboard.db'))

raw.run('PRAGMA journal_mode = WAL')
raw.run('PRAGMA foreign_keys = ON')

raw.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL,
    cog TEXT,
    before_data TEXT,
    after_data TEXT
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    duration TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    winners_count INTEGER NOT NULL DEFAULT 1,
    winners TEXT NOT NULL DEFAULT '[]',
    entries TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`)

setInterval(() => raw.run('DELETE FROM sessions WHERE expired <= ?', Date.now()), 60_000)

const db = {
  get: (sql, params = []) => new Promise((res, rej) =>
    raw.get(sql, params, (err, row) => err ? rej(err) : res(row))
  ),
  all: (sql, params = []) => new Promise((res, rej) =>
    raw.all(sql, params, (err, rows) => err ? rej(err) : res(rows))
  ),
  run: (sql, params = []) => new Promise((res, rej) =>
    raw.run(sql, params, function (err) { err ? rej(err) : res(this) })
  ),
  raw,
}

module.exports = db
