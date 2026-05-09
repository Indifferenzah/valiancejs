'use strict';

const { EmbedBuilder } = require('discord.js');
const db = require('../db/logDatabase');
const logger = require('../../../utils/logger');

const TIMEZONE = 'Europe/Rome';

/**
 * Feature 18: Daily Digest
 * Traccia eventi giornalieri e invia un riepilogo
 */

/**
 * Ottiene la data corrente in formato YYYY-MM-DD nel fuso orario Europe/Rome
 */
function getTodayDate() {
    return new Date().toLocaleDateString('it-IT', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split('/').reverse().join('-'); // YYYY-MM-DD
}

function getYesterdayDate() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('it-IT', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split('/').reverse().join('-');
}

/**
 * Incrementa il contatore per un tipo di evento
 * @param {string} guildId
 * @param {string} eventType
 */
async function trackEvent(guildId, eventType) {
    try {
        const date = getTodayDate();
        const existing = await db.get(
            'SELECT * FROM log_daily_events WHERE guild_id = ? AND event_type = ? AND date = ?',
            [guildId, eventType, date]
        );

        if (existing) {
            await db.run(
                'UPDATE log_daily_events SET count = count + 1 WHERE id = ?',
                [existing.id]
            );
        } else {
            await db.run(
                'INSERT INTO log_daily_events (guild_id, event_type, count, date) VALUES (?, ?, 1, ?)',
                [guildId, eventType, date]
            );
        }
    } catch (err) {
        logger.error('[DailyDigest] Errore trackEvent:', err);
    }
}

/**
 * Invia il digest giornaliero in un canale
 * @param {Guild} guild
 * @param {string} channelId
 * @param {Client} client
 */
async function sendDigest(guild, channelId, client) {
    try {
        if (!channelId) return;

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const date = getYesterdayDate();
        const rows = await db.all(
            'SELECT event_type, count FROM log_daily_events WHERE guild_id = ? AND date = ?',
            [guild.id, date]
        );

        // Costruisci mappa degli eventi
        const stats = {};
        for (const row of rows) {
            stats[row.event_type] = row.count;
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📊 Riepilogo Giornaliero')
            .setDescription(`Statistiche del **${date}** per **${guild.name}**`)
            .addFields(
                { name: '👋 Utenti Entrati', value: (stats.guildMemberAdd || 0).toString(), inline: true },
                { name: '👋 Utenti Usciti', value: (stats.guildMemberRemove || 0).toString(), inline: true },
                { name: '🔨 Ban', value: (stats.guildBanAdd || 0).toString(), inline: true },
                { name: '👢 Kick', value: (stats.memberKick || 0).toString(), inline: true },
                { name: '⏱️ Timeout', value: (stats.memberTimeoutAdd || 0).toString(), inline: true },
                { name: '🗑️ Messaggi Eliminati', value: (stats.messageDelete || 0).toString(), inline: true },
                { name: '✏️ Messaggi Modificati', value: (stats.messageUpdate || 0).toString(), inline: true },
                { name: '🔊 Join Vocale', value: (stats.voiceChannelJoin || 0).toString(), inline: true },
                { name: '📢 Canali Creati', value: (stats.channelCreate || 0).toString(), inline: true },
                { name: '⚡ Interazioni', value: (stats.interactionCreate || 0).toString(), inline: true },
                { name: '🛡️ Azioni AutoMod', value: (stats.autoModerationActionExecution || 0).toString(), inline: true }
            )
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .setTimestamp()
            .setFooter({ text: `Valiance Log System | Riepilogo ${date}` });

        await channel.send({ embeds: [embed] });
        logger.info(`[DailyDigest] Digest inviato per il server ${guild.id}`);
    } catch (err) {
        logger.error('[DailyDigest] Errore sendDigest:', err);
    }
}

/**
 * Pianifica il digest giornaliero a mezzanotte (Europe/Rome)
 * Controlla ogni minuto se sono le 00:00-00:01
 * @param {Client} client
 * @param {string} guildId
 * @param {string} channelId
 */
function scheduleDailyDigest(client, guildId, channelId) {
    let lastSentDate = null;

    const check = async () => {
        try {
            const now = new Date();
            const hours = parseInt(now.toLocaleString('it-IT', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }));
            const minutes = parseInt(now.toLocaleString('it-IT', { timeZone: TIMEZONE, minute: '2-digit' }));
            const today = getTodayDate();

            // Invia solo una volta alle 00:00-00:01
            if (hours === 0 && minutes <= 1 && lastSentDate !== today) {
                lastSentDate = today;
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (guild) {
                    await sendDigest(guild, channelId, client);
                }
            }
        } catch (err) {
            logger.error('[DailyDigest] Errore nel check schedulato:', err);
        }
    };

    const interval = setInterval(check, 60 * 1000); // ogni minuto
    interval.unref();
    logger.info(`[DailyDigest] Scheduler avviato per il server ${guildId}`);
    return interval;
}

module.exports = { trackEvent, sendDigest, scheduleDailyDigest };
