'use strict';

const db = require('../db/logDatabase');
const logger = require('../../../utils/logger');

/**
 * Feature 17: Voice Tracker
 * Traccia sessioni vocali e calcola statistiche
 */

/**
 * Formatta i millisecondi in "Xh Ym"
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
    if (!ms || ms <= 0) return '0m';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

/**
 * Registra l'ingresso in un canale vocale
 * @param {GuildMember} member
 * @param {VoiceChannel} channel
 */
async function trackJoin(member, channel) {
    try {
        if (!member || !channel) return;
        await db.run(
            `INSERT INTO log_voice_sessions (guild_id, user_id, user_tag, channel_id, channel_name, joined_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                member.guild.id,
                member.id,
                member.user.tag,
                channel.id,
                channel.name,
                Date.now()
            ]
        );
    } catch (err) {
        logger.error('[VoiceTracker] Errore trackJoin:', err);
    }
}

/**
 * Registra l'uscita da un canale vocale, calcola la durata
 * @param {GuildMember} member
 * @param {VoiceChannel} channel
 */
async function trackLeave(member, channel) {
    try {
        if (!member || !channel) return;

        const now = Date.now();

        // Trova l'ultima sessione aperta per questo utente in questo canale
        const session = await db.get(
            `SELECT * FROM log_voice_sessions
             WHERE guild_id = ? AND user_id = ? AND channel_id = ? AND left_at IS NULL
             ORDER BY joined_at DESC LIMIT 1`,
            [member.guild.id, member.id, channel.id]
        );

        if (!session) {
            // Nessuna sessione aperta trovata
            return;
        }

        const duration = now - session.joined_at;

        await db.run(
            'UPDATE log_voice_sessions SET left_at = ?, duration = ? WHERE id = ?',
            [now, duration, session.id]
        );
    } catch (err) {
        logger.error('[VoiceTracker] Errore trackLeave:', err);
    }
}

/**
 * Calcola il tempo totale in vocale per un utente negli ultimi X giorni
 * @param {string} guildId
 * @param {string} userId
 * @param {number} days
 * @returns {{ totalMs: number, totalFormatted: string, sessionCount: number }}
 */
async function getUserStats(guildId, userId, days = 7) {
    try {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

        const result = await db.get(
            `SELECT SUM(duration) as total, COUNT(*) as sessions
             FROM log_voice_sessions
             WHERE guild_id = ? AND user_id = ? AND joined_at > ? AND duration IS NOT NULL`,
            [guildId, userId, cutoff]
        );

        const totalMs = result?.total || 0;
        return {
            totalMs,
            totalFormatted: formatDuration(totalMs),
            sessionCount: result?.sessions || 0
        };
    } catch (err) {
        logger.error('[VoiceTracker] Errore getUserStats:', err);
        return { totalMs: 0, totalFormatted: '0m', sessionCount: 0 };
    }
}

/**
 * Classifica degli utenti per tempo in vocale
 * @param {string} guildId
 * @param {number} days
 * @param {number} limit
 * @returns {Array<{ user_id: string, user_tag: string, total: number, sessions: number }>}
 */
async function getLeaderboard(guildId, days = 7, limit = 10) {
    try {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

        const rows = await db.all(
            `SELECT user_id, user_tag, SUM(duration) as total, COUNT(*) as sessions
             FROM log_voice_sessions
             WHERE guild_id = ? AND joined_at > ? AND duration IS NOT NULL
             GROUP BY user_id
             ORDER BY total DESC
             LIMIT ?`,
            [guildId, cutoff, limit]
        );

        return rows.map(r => ({
            ...r,
            totalFormatted: formatDuration(r.total)
        }));
    } catch (err) {
        logger.error('[VoiceTracker] Errore getLeaderboard:', err);
        return [];
    }
}

module.exports = { trackJoin, trackLeave, getUserStats, getLeaderboard, formatDuration };
