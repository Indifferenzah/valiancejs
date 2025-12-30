const logger = require('../../utils/logger');
const { commands, contextMenus } = require('../commands/builders');

/**
 * Handler per l'evento ready del client
 */
async function onReady(client) {
    client.startTime = new Date();
    logger.info(`Bot connected as ${client.user.tag}`);
    
    // Importa e avvia il servizio di status
    const { startStatusUpdater } = require('../services/statusService');
    startStatusUpdater(client);
    
    try {
        const allCommands = [
            ...commands,
            ...contextMenus,
        ];

        if (client.globalCommands) {
            allCommands.push(...client.globalCommands);
        }
        
        await client.application.commands.set(allCommands);
        logger.info(`Synced ${allCommands.length} slash commands`);
    } catch (error) {
        logger.error(`Error syncing commands: ${error.message}`);
    }

    try {
        const VerifyView = require('../../views/VerifyView');
        const { getConfig } = require('../core/config');
        const config = getConfig();
        client.verifyView = new VerifyView(config);
        logger.info('VerifyView registered as persistent view');
    } catch (error) {
        logger.error(`Error registering VerifyView: ${error.message}`);
    }

    const counterCog = client.cogs.get('counters');
    if (counterCog && counterCog.onReady) {
        await counterCog.onReady();
    }

    const ticketCog = client.cogs.get('ticket');
    if (ticketCog?.restoreTicketPanel) {
        await ticketCog.restoreTicketPanel();
    }
}

module.exports = { onReady };
