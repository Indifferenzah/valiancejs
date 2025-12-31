const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * Carica tutti i cogs dalla cartella cogs
 */
function loadCogs(client) {
    const cogsToLoad = [
        'ticket/ticket',
        'moderation/moderation', 
        'autorole/autorole',
        'log/log',
        'fun/fun',
        'regole/regole',
        'tts/tts',
        'cw/cw',
        'giveaway/giveaway',
        'help',
        'util/reminders',
        'social/marriage',
        'rep/reputation',
        'birthdays/birthdays',
        'counters/counters',
        // 'aimod/aimod',
        // 'coralmc/coralmc',
        'traduttore/traduttore',
        'leveling/leveling'
        // done 'invites/invites'
    ];

    for (const cogPath of cogsToLoad) {
        try {
            const cogFile = path.join(process.cwd(), 'cogs', `${cogPath}.js`);
            if (fs.existsSync(cogFile)) {
                delete require.cache[require.resolve(cogFile)];
                const cog = require(cogFile);
                if (cog.setup) {
                    const cogInstance = cog.setup(client);
                    const cogName = cogPath.split('/').pop();
                    client.cogs.set(cogName, cogInstance);
                    logger.info(`Loaded cog: ${cogName}`);
                } else {
                    logger.warn(`Cog ${cogPath} has no setup function`);
                }
            } else {
                logger.warn(`Cog file not found: ${cogPath}`);
            }
        } catch (error) {
            logger.error(`Failed to load cog ${cogPath}: ${error.message}`);
        }
    }

    // Bind AI-MOD con moderation se entrambi sono caricati
    const aimodCog = client.cogs.get('aimod');
    const moderationCog = client.cogs.get('moderation');

    if (aimodCog && moderationCog) {
        aimodCog.bindModerationCog(moderationCog);
        logger.info('[AI-MOD] Bind con moderation effettuato');
    } else {
        logger.warn('[AI-MOD] Bind saltato: aimod o moderation mancanti');
    }
}

module.exports = { loadCogs };
