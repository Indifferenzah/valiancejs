const { PermissionFlagsBits } = require('discord.js');
const logger = require('../../../utils/logger');
const { ownerOrHasPermissions } = require('../../../utils/botUtils');
const { activeSessions } = require('../../state/sessionState');
const { cleanupSession } = require('../../game/gameManager');

/**
 * Gestisce il comando /cwend
 */
async function handleCwEnd(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const guildId = interaction.guild.id;
    
    if (!activeSessions.has(guildId)) {
        await interaction.reply({ content: '❌ Non ci sono partite attive!', ephemeral: true });
        return;
    }

    await interaction.reply({ content: '🧹 Terminazione partita in corso...', ephemeral: true });
    await cleanupSession(guildId);
    
    try {
        await interaction.followUp({ content: '✅ Partita terminata e canali eliminati!', ephemeral: true });
    } catch (error) {
        // Ignora se il canale è stato eliminato
        logger.debug(`Could not send followUp after cleanup: ${error.message}`);
    }
    
    logger.info(`Game ended by ${interaction.user.tag} in ${interaction.guild.name}`);
}

module.exports = { handleCwEnd };
