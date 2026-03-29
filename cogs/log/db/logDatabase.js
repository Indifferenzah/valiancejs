'use strict';

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('../../../utils/logger');

const DB_PATH = path.join(process.cwd(), 'data', 'log.db');

class LogDatabase {
    constructor() {
        this.db = null;
        this.ready = false;
    }

    init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    logger.error('[LogDatabase] Errore apertura database:', err);
                    return reject(err);
                }
                logger.info(`[LogDatabase] Database aperto: ${DB_PATH}`);
                this.db.run('PRAGMA journal_mode = WAL;');
                this.db.run('PRAGMA synchronous = NORMAL;');
                this._createTables()
                    .then(() => {
                        this.ready = true;
                        logger.info('[LogDatabase] Tabelle inizializzate correttamente');
                        resolve();
                    })
                    .catch(reject);
            });
        });
    }

    _createTables() {
        const statements = [
            `CREATE TABLE IF NOT EXISTS log_snipe (
                channel_id TEXT PRIMARY KEY,
                guild_id TEXT,
                author_id TEXT,
                author_tag TEXT,
                content TEXT,
                attachments TEXT,
                deleted_at INTEGER
            )`,
            `CREATE TABLE IF NOT EXISTS log_edit_snipe (
                channel_id TEXT PRIMARY KEY,
                guild_id TEXT,
                message_id TEXT,
                author_id TEXT,
                author_tag TEXT,
                old_content TEXT,
                new_content TEXT,
                edited_at INTEGER
            )`,
            `CREATE TABLE IF NOT EXISTS log_voice_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_tag TEXT,
                channel_id TEXT NOT NULL,
                channel_name TEXT,
                joined_at INTEGER NOT NULL,
                left_at INTEGER,
                duration INTEGER
            )`,
            `CREATE TABLE IF NOT EXISTS log_watchlist (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                added_by TEXT,
                reason TEXT,
                added_at INTEGER,
                PRIMARY KEY (guild_id, user_id)
            )`,
            `CREATE TABLE IF NOT EXISTS log_message_cache (
                message_id TEXT PRIMARY KEY,
                guild_id TEXT,
                channel_id TEXT NOT NULL,
                author_id TEXT NOT NULL,
                content TEXT,
                attachments TEXT,
                created_at INTEGER NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS log_username_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                old_username TEXT,
                new_username TEXT,
                old_avatar TEXT,
                new_avatar TEXT,
                changed_at INTEGER NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS log_duplicate_tracker (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                count INTEGER DEFAULT 1,
                first_at INTEGER,
                last_at INTEGER,
                PRIMARY KEY (guild_id, user_id, content)
            )`,
            `CREATE TABLE IF NOT EXISTS log_raid_tracker (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                joined_at INTEGER NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS log_daily_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                count INTEGER DEFAULT 1,
                date TEXT NOT NULL
            )`,
            // Index for performance
            `CREATE INDEX IF NOT EXISTS idx_voice_sessions_guild_user ON log_voice_sessions(guild_id, user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_username_history_user ON log_username_history(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_raid_tracker_guild ON log_raid_tracker(guild_id, joined_at)`,
            `CREATE INDEX IF NOT EXISTS idx_daily_events_guild_date ON log_daily_events(guild_id, date)`,
            `CREATE INDEX IF NOT EXISTS idx_message_cache_created ON log_message_cache(created_at)`
        ];

        return statements.reduce((promise, sql) => {
            return promise.then(() => this.run(sql));
        }, Promise.resolve());
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('[LogDatabase] Database non inizializzato'));
            this.db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('[LogDatabase] Database non inizializzato'));
            this.db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('[LogDatabase] Database non inizializzato'));
            this.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            this.db.close((err) => {
                if (err) return reject(err);
                logger.info('[LogDatabase] Database chiuso');
                resolve();
            });
        });
    }
}

// Singleton
const db = new LogDatabase();
module.exports = db;
