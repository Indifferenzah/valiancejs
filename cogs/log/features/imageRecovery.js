'use strict';

const db = require('../db/logDatabase');
const logger = require('../../../utils/logger');

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

/**
 * Feature 11: Image Recovery
 * Mette in cache i messaggi con allegati per recuperarli quando vengono eliminati
 */

async function cacheMessage(message) {
    try {
        if (!message || !message.author || message.author.bot) return;
        if (!message.attachments || message.attachments.size === 0) return;

        const attachments = JSON.stringify(
            Array.from(message.attachments.values()).map(a => ({
                url: a.url,
                name: a.name,
                contentType: a.contentType || null
            }))
        );

        await db.run(
            `INSERT OR REPLACE INTO log_message_cache
             (message_id, guild_id, channel_id, author_id, content, attachments, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                message.id,
                message.guild?.id || null,
                message.channel.id,
                message.author.id,
                message.content || null,
                attachments,
                Date.now()
            ]
        );
    } catch (err) {
        logger.error('[ImageRecovery] Errore cacheMessage:', err);
    }
}

async function getMessageCache(messageId) {
    try {
        const row = await db.get(
            'SELECT * FROM log_message_cache WHERE message_id = ?',
            [messageId]
        );
        if (!row) return null;

        if (row.attachments) {
            try {
                row.attachmentsParsed = JSON.parse(row.attachments);
            } catch {
                row.attachmentsParsed = [];
            }
        }
        return row;
    } catch (err) {
        logger.error('[ImageRecovery] Errore getMessageCache:', err);
        return null;
    }
}

async function cleanOldCache() {
    try {
        const cutoff = Date.now() - CACHE_TTL_MS;
        const result = await db.run(
            'DELETE FROM log_message_cache WHERE created_at < ?',
            [cutoff]
        );
        if (result.changes > 0) {
            logger.info(`[ImageRecovery] Pulite ${result.changes} voci di cache vecchie`);
        }
    } catch (err) {
        logger.error('[ImageRecovery] Errore cleanOldCache:', err);
    }
}

module.exports = { cacheMessage, getMessageCache, cleanOldCache };
