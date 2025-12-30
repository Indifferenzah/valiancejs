const { loadConfig } = require('../core/config');

/**
 * Ricarica la configurazione globale e aggiorna i cog
 */
function reloadGlobalConfig(client) {
    const config = loadConfig();

    const moderationCog = client.cogs.get('moderation');
    if (moderationCog && moderationCog.reloadConfig) {
        moderationCog.reloadConfig();
    }

    const logCog = client.cogs.get('log');
    if (logCog && logCog.reloadConfig) {
        logCog.reloadConfig();
    }
}

/**
 * Ricarica tutti i cog e la configurazione
 */
function reloadAll(client) {
    const config = loadConfig();

    const moderationCog = client.cogs.get('moderation');
    if (moderationCog && moderationCog.reloadMod) {
        moderationCog.reloadMod();
    }

    const ticketCog = client.cogs.get('ticket');
    if (ticketCog && ticketCog.reloadTicket) {
        ticketCog.reloadTicket();
    }

    const logCog = client.cogs.get('log');
    if (logCog && logCog.reloadConfig) {
        logCog.reloadConfig();
    }
}

module.exports = { reloadGlobalConfig, reloadAll };
