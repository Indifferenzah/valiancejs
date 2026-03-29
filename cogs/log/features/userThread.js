'use strict';

const { ChannelType } = require('discord.js');
const logger = require('../../../utils/logger');

/**
 * Feature 21: User Thread
 * Crea o recupera thread per utenti nella watchlist
 */

/**
 * Cerca un thread esistente per un utente (cerca per userId nel nome)
 * @param {TextChannel} channel
 * @param {string} userId
 * @returns {ThreadChannel|null}
 */
async function getExistingThread(channel, userId) {
    try {
        if (!channel || channel.type !== ChannelType.GuildText) return null;

        // Controlla thread attivi
        const active = await channel.threads.fetchActive().catch(() => null);
        if (active) {
            const found = active.threads.find(t => t.name.includes(`(${userId})`));
            if (found) return found;
        }

        // Controlla thread archiviati recenti
        const archived = await channel.threads.fetchArchived({ limit: 50 }).catch(() => null);
        if (archived) {
            const found = archived.threads.find(t => t.name.includes(`(${userId})`));
            if (found) {
                // Riaprilo se archiviato
                try {
                    await found.setArchived(false);
                } catch { /* ignora errori di unarchive */ }
                return found;
            }
        }

        return null;
    } catch (err) {
        logger.error('[UserThread] Errore getExistingThread:', err);
        return null;
    }
}

/**
 * Crea o trova un thread per un utente
 * @param {TextChannel} channel
 * @param {User} user
 * @returns {ThreadChannel|null}
 */
async function createOrGetThread(channel, user) {
    try {
        if (!channel || channel.type !== ChannelType.GuildText) return null;

        // Controlla se esiste già
        const existing = await getExistingThread(channel, user.id);
        if (existing) return existing;

        // Crea nuovo thread
        const threadName = `👤 ${user.username} (${user.id})`.substring(0, 100);

        const thread = await channel.threads.create({
            name: threadName,
            autoArchiveDuration: 10080, // 7 giorni
            reason: `Thread watchlist per ${user.tag}`
        });

        logger.info(`[UserThread] Thread creato: "${threadName}" in #${channel.name}`);
        return thread;
    } catch (err) {
        logger.error('[UserThread] Errore createOrGetThread:', err);
        return null;
    }
}

module.exports = { createOrGetThread, getExistingThread };
