'use strict';

const db = require('../db/logDatabase');
const logger = require('../../../utils/logger');

/**
 * Feature 9: Anti-Snipe
 * Salva i messaggi eliminati/modificati per il recupero via /snipe e /editsnipe
 */

async function saveDeletedMessage(message) {
    try {
        if (!message || !message.channel) return;

        const attachments = message.attachments && message.attachments.size > 0
            ? JSON.stringify(message.attachments.map(a => a.url))
            : null;

        await db.run(
            `INSERT OR REPLACE INTO log_snipe
             (channel_id, guild_id, author_id, author_tag, content, attachments, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                message.channel.id,
                message.guild?.id || null,
                message.author?.id || null,
                message.author?.tag || 'Sconosciuto',
                message.content || null,
                attachments,
                Date.now()
            ]
        );
    } catch (err) {
        logger.error('[AntiSnipe] Errore saveDeletedMessage:', err);
    }
}

async function saveEditedMessage(oldMessage, newMessage) {
    try {
        if (!newMessage || !newMessage.channel) return;

        await db.run(
            `INSERT OR REPLACE INTO log_edit_snipe
             (channel_id, guild_id, message_id, author_id, author_tag, old_content, new_content, edited_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newMessage.channel.id,
                newMessage.guild?.id || null,
                newMessage.id,
                newMessage.author?.id || null,
                newMessage.author?.tag || 'Sconosciuto',
                oldMessage.content || null,
                newMessage.content || null,
                Date.now()
            ]
        );
    } catch (err) {
        logger.error('[AntiSnipe] Errore saveEditedMessage:', err);
    }
}

async function getSnipe(channelId) {
    try {
        return await db.get(
            'SELECT * FROM log_snipe WHERE channel_id = ?',
            [channelId]
        );
    } catch (err) {
        logger.error('[AntiSnipe] Errore getSnipe:', err);
        return null;
    }
}

async function getEditSnipe(channelId) {
    try {
        return await db.get(
            'SELECT * FROM log_edit_snipe WHERE channel_id = ?',
            [channelId]
        );
    } catch (err) {
        logger.error('[AntiSnipe] Errore getEditSnipe:', err);
        return null;
    }
}

module.exports = {
    saveDeletedMessage,
    saveEditedMessage,
    getSnipe,
    getEditSnipe
};
