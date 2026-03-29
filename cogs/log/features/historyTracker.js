'use strict';

const db = require('../db/logDatabase');
const logger = require('../../../utils/logger');

/**
 * Feature 19: History Tracker
 * Traccia i cambiamenti di username e avatar degli utenti
 */

/**
 * Salva un cambio di username/avatar nella storia
 * @param {User} oldUser
 * @param {User} newUser
 */
async function trackUsernameChange(oldUser, newUser) {
    try {
        const usernameChanged = oldUser.username !== newUser.username ||
            oldUser.discriminator !== newUser.discriminator ||
            (oldUser.globalName || '') !== (newUser.globalName || '');
        const avatarChanged = oldUser.avatarURL() !== newUser.avatarURL();

        if (!usernameChanged && !avatarChanged) return;

        const oldTag = oldUser.discriminator && oldUser.discriminator !== '0'
            ? `${oldUser.username}#${oldUser.discriminator}`
            : (oldUser.globalName || oldUser.username);
        const newTag = newUser.discriminator && newUser.discriminator !== '0'
            ? `${newUser.username}#${newUser.discriminator}`
            : (newUser.globalName || newUser.username);

        await db.run(
            `INSERT INTO log_username_history (user_id, old_username, new_username, old_avatar, new_avatar, changed_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                newUser.id,
                oldTag,
                newTag,
                oldUser.avatarURL({ size: 256 }) || null,
                newUser.avatarURL({ size: 256 }) || null,
                Date.now()
            ]
        );
    } catch (err) {
        logger.error('[HistoryTracker] Errore trackUsernameChange:', err);
    }
}

/**
 * Recupera la storia degli ultimi N cambiamenti per un utente
 * @param {string} userId
 * @param {number} limit
 * @returns {Array}
 */
async function getHistory(userId, limit = 10) {
    try {
        return await db.all(
            `SELECT * FROM log_username_history WHERE user_id = ? ORDER BY changed_at DESC LIMIT ?`,
            [userId, limit]
        );
    } catch (err) {
        logger.error('[HistoryTracker] Errore getHistory:', err);
        return [];
    }
}

/**
 * Formatta la storia in embed fields
 * @param {Array} entries
 * @returns {Array<{ name: string, value: string, inline: boolean }>}
 */
function formatHistory(entries) {
    if (!entries || entries.length === 0) {
        return [{ name: 'Nessuna Storia', value: 'Nessun cambiamento registrato.', inline: false }];
    }

    return entries.slice(0, 10).map((entry, i) => {
        const date = new Date(entry.changed_at);
        const timestamp = `<t:${Math.floor(entry.changed_at / 1000)}:R>`;
        const parts = [];

        if (entry.old_username !== entry.new_username) {
            parts.push(`**Username:** ${entry.old_username} → ${entry.new_username}`);
        }
        if (entry.old_avatar !== entry.new_avatar) {
            parts.push(`**Avatar:** [Prima](${entry.old_avatar || 'N/A'}) → [Dopo](${entry.new_avatar || 'N/A'})`);
        }

        return {
            name: `#${i + 1} — ${timestamp}`,
            value: parts.join('\n') || 'Cambio sconosciuto',
            inline: false
        };
    });
}

module.exports = { trackUsernameChange, getHistory, formatHistory };
