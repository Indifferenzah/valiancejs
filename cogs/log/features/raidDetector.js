'use strict';

const { EmbedBuilder } = require('discord.js');
const db = require('../db/logDatabase');
const logger = require('../../../utils/logger');

const RAID_WINDOW_MS = 30 * 1000;     // 30 secondi
const RAID_THRESHOLD = 5;              // 5+ join = raid
const CLEAN_WINDOW_MS = 60 * 1000;    // pulisci voci > 60s

/**
 * Feature 14: Raid Detector
 * Rileva potenziali raid basandosi sul numero di join in un breve intervallo
 */

async function trackJoin(member) {
    try {
        await db.run(
            'INSERT INTO log_raid_tracker (guild_id, user_id, joined_at) VALUES (?, ?, ?)',
            [member.guild.id, member.id, Date.now()]
        );
    } catch (err) {
        logger.error('[RaidDetector] Errore trackJoin:', err);
    }
}

async function checkRaid(guild) {
    try {
        const cutoff = Date.now() - RAID_WINDOW_MS;
        const rows = await db.all(
            'SELECT user_id FROM log_raid_tracker WHERE guild_id = ? AND joined_at > ?',
            [guild.id, cutoff]
        );

        const count = rows.length;
        const isRaid = count >= RAID_THRESHOLD;
        const users = rows.map(r => r.user_id);

        return { isRaid, count, users };
    } catch (err) {
        logger.error('[RaidDetector] Errore checkRaid:', err);
        return { isRaid: false, count: 0, users: [] };
    }
}

async function cleanOldEntries() {
    try {
        const cutoff = Date.now() - CLEAN_WINDOW_MS;
        await db.run(
            'DELETE FROM log_raid_tracker WHERE joined_at < ?',
            [cutoff]
        );
    } catch (err) {
        logger.error('[RaidDetector] Errore cleanOldEntries:', err);
    }
}

/**
 * Invia un alert di raid nel canale specificato
 * @param {Guild} guild
 * @param {object} raidInfo - { count, users }
 * @param {string} alertChannelId
 * @param {string|null} staffRoleId - se impostato, menziona il ruolo
 */
async function sendRaidAlert(guild, raidInfo, alertChannelId, staffRoleId) {
    try {
        if (!alertChannelId) return;

        const channel = await guild.client.channels.fetch(alertChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const userMentions = raidInfo.users.slice(0, 20).map(id => `<@${id}>`).join(', ');

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⚠️ POSSIBILE RAID RILEVATO')
            .setDescription(`${raidInfo.count} utenti si sono uniti negli ultimi 30 secondi!`)
            .addFields(
                { name: 'Utenti Entrati', value: userMentions || 'N/A', inline: false },
                { name: 'Totale Join', value: raidInfo.count.toString(), inline: true },
                { name: 'Finestra', value: '30 secondi', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Raid Detector | Valiance' });

        const mention = staffRoleId ? `<@&${staffRoleId}>` : '@everyone';
        await channel.send({ content: `${mention} **ALLERTA RAID!**`, embeds: [embed] });

        logger.warn(`[RaidDetector] Raid rilevato nel server ${guild.id}: ${raidInfo.count} join in 30s`);
    } catch (err) {
        logger.error('[RaidDetector] Errore sendRaidAlert:', err);
    }
}

module.exports = { trackJoin, checkRaid, cleanOldEntries, sendRaidAlert };
