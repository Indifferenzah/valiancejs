const { PermissionFlagsBits } = require('discord.js');
const logger = require('../../../utils/logger');
const { ownerOrHasPermissions } = require('../../../utils/botUtils');
const { getConfig } = require('../../core/config');
const { setWaitingForRuleset } = require('../../state/sessionState');

/**
 * Gestisce il comando /setruleset
 */
async function handleSetRuleset(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    setWaitingForRuleset(true);
    await interaction.reply({ content: '📝 Invia il prossimo messaggio che vuoi salvare come ruleset.', ephemeral: false });
    logger.info(`/setruleset used by ${interaction.user.tag} in ${interaction.guild.name}`);
}

/**
 * Gestisce il comando /ruleset
 */
async function handleRuleset(interaction) {
    const config = getConfig();
    
    if (!config.ruleset_message) {
        await interaction.reply({ content: '❌ Nessun ruleset configurato! Usa `/setruleset` per impostarne uno.', ephemeral: false });
        return;
    }

    await interaction.reply({ content: config.ruleset_message, ephemeral: false });
    logger.info(`Ruleset shown to ${interaction.user.tag} in ${interaction.guild.name}`);
}

module.exports = { handleSetRuleset, handleRuleset };
