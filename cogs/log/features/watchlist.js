'use strict';

const { EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../db/logDatabase');
const logger = require('../../../utils/logger');

/**
 * Feature 13: Watchlist
 * Monitora utenti specifici e loga le loro azioni in dettaglio
 */

async function addToWatchlist(guildId, userId, addedBy, reason) {
    try {
        await db.run(
            `INSERT OR REPLACE INTO log_watchlist (guild_id, user_id, added_by, reason, added_at)
             VALUES (?, ?, ?, ?, ?)`,
            [guildId, userId, addedBy || null, reason || null, Date.now()]
        );
        logger.info(`[Watchlist] Utente ${userId} aggiunto alla watchlist nel server ${guildId}`);
        return true;
    } catch (err) {
        logger.error('[Watchlist] Errore addToWatchlist:', err);
        return false;
    }
}

async function removeFromWatchlist(guildId, userId) {
    try {
        const result = await db.run(
            'DELETE FROM log_watchlist WHERE guild_id = ? AND user_id = ?',
            [guildId, userId]
        );
        return result.changes > 0;
    } catch (err) {
        logger.error('[Watchlist] Errore removeFromWatchlist:', err);
        return false;
    }
}

async function isWatched(guildId, userId) {
    try {
        const row = await db.get(
            'SELECT 1 FROM log_watchlist WHERE guild_id = ? AND user_id = ?',
            [guildId, userId]
        );
        return !!row;
    } catch (err) {
        logger.error('[Watchlist] Errore isWatched:', err);
        return false;
    }
}

async function getWatchlist(guildId) {
    try {
        return await db.all(
            'SELECT * FROM log_watchlist WHERE guild_id = ? ORDER BY added_at DESC',
            [guildId]
        );
    } catch (err) {
        logger.error('[Watchlist] Errore getWatchlist:', err);
        return [];
    }
}

/**
 * Invia un log dettagliato per un utente nella watchlist.
 * Se watchlistChannelId non è impostato, usa il canale dell'evento.
 */
async function logWatchedAction(guild, user, action, details, loggerFactory, watchlistChannelId) {
    try {
        const embed = new EmbedBuilder()
            .setColor('#FF6B35')
            .setTitle(`🔍 Watchlist: ${action}`)
            .setDescription(`Azione rilevata per un utente monitorato`)
            .addFields(
                { name: 'Utente', value: `${user.tag} (<@${user.id}>)`, inline: true },
                { name: 'ID', value: user.id, inline: true },
                { name: 'Server', value: guild.name, inline: true },
                { name: 'Azione', value: action, inline: false },
                { name: 'Dettagli', value: details || 'Nessun dettaglio', inline: false }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp()
            .setFooter({ text: `Watchlist | ID: ${user.id}` });

        let targetChannelId = watchlistChannelId;

        if (!targetChannelId) {
            // Prova a trovare il canale di log per l'evento guildMemberUpdate
            const configManager = loggerFactory?.configManager;
            if (configManager) {
                targetChannelId = configManager.getEventChannel(guild.id, 'guildMemberUpdate');
            }
        }

        if (!targetChannelId) return;

        const channel = await guild.client.channels.fetch(targetChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        // Prova a creare/trovare un thread per l'utente
        const userThread = require('./userThread');
        if (channel.type === ChannelType.GuildText) {
            try {
                const thread = await userThread.createOrGetThread(channel, user);
                if (thread) {
                    await thread.send({ embeds: [embed] });
                    return;
                }
            } catch {
                // fallback al canale principale
            }
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        logger.error('[Watchlist] Errore logWatchedAction:', err);
    }
}

module.exports = {
    addToWatchlist,
    removeFromWatchlist,
    isWatched,
    getWatchlist,
    logWatchedAction
};
