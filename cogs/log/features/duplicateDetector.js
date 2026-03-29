'use strict';

const db = require('../db/logDatabase');
const logger = require('../../../utils/logger');

const WINDOW_MS = 10 * 60 * 1000;  // 10 minuti
const DUPLICATE_THRESHOLD = 3;
const CLEAN_INTERVAL_MS = 30 * 60 * 1000; // 30 minuti

/**
 * Feature 12: Duplicate Detector
 * Rileva messaggi duplicati inviati dallo stesso utente
 */

async function trackMessage(message) {
    try {
        if (!message || !message.author || message.author.bot) return;
        if (!message.guild) return;
        if (!message.content || message.content.trim().length === 0) return;

        const content = message.content.trim().toLowerCase().substring(0, 500);
        const now = Date.now();

        const existing = await db.get(
            'SELECT * FROM log_duplicate_tracker WHERE guild_id = ? AND user_id = ? AND content = ?',
            [message.guild.id, message.author.id, content]
        );

        if (existing) {
            await db.run(
                'UPDATE log_duplicate_tracker SET count = count + 1, last_at = ? WHERE guild_id = ? AND user_id = ? AND content = ?',
                [now, message.guild.id, message.author.id, content]
            );
        } else {
            await db.run(
                'INSERT OR REPLACE INTO log_duplicate_tracker (guild_id, user_id, content, count, first_at, last_at) VALUES (?, ?, ?, 1, ?, ?)',
                [message.guild.id, message.author.id, content, now, now]
            );
        }
    } catch (err) {
        logger.error('[DuplicateDetector] Errore trackMessage:', err);
    }
}

async function checkDuplicate(message) {
    try {
        if (!message || !message.author || message.author.bot) return { isDuplicate: false, count: 0 };
        if (!message.guild) return { isDuplicate: false, count: 0 };
        if (!message.content || message.content.trim().length === 0) return { isDuplicate: false, count: 0 };

        const content = message.content.trim().toLowerCase().substring(0, 500);
        const cutoff = Date.now() - WINDOW_MS;

        const row = await db.get(
            'SELECT * FROM log_duplicate_tracker WHERE guild_id = ? AND user_id = ? AND content = ? AND last_at > ?',
            [message.guild.id, message.author.id, content, cutoff]
        );

        if (!row) return { isDuplicate: false, count: 0 };

        const isDuplicate = row.count >= DUPLICATE_THRESHOLD;
        return { isDuplicate, count: row.count };
    } catch (err) {
        logger.error('[DuplicateDetector] Errore checkDuplicate:', err);
        return { isDuplicate: false, count: 0 };
    }
}

async function cleanOldEntries() {
    try {
        const cutoff = Date.now() - CLEAN_INTERVAL_MS;
        const result = await db.run(
            'DELETE FROM log_duplicate_tracker WHERE last_at < ?',
            [cutoff]
        );
        if (result.changes > 0) {
            logger.debug(`[DuplicateDetector] Rimosse ${result.changes} voci vecchie`);
        }
    } catch (err) {
        logger.error('[DuplicateDetector] Errore cleanOldEntries:', err);
    }
}

module.exports = { trackMessage, checkDuplicate, cleanOldEntries };
