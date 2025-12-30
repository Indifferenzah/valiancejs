const { PermissionFlagsBits } = require('discord.js');
const logger = require('../../../utils/logger');
const { ownerOrHasPermissions } = require('../../../utils/botUtils');

/**
 * Gestisce il comando /ping
 */
async function handlePing(interaction) {
    const latency = Math.round(interaction.client.ws.ping);

    await interaction.reply({
        content: `🏓 Pong! Latenza: ${latency}ms`,
        ephemeral: true
    });

    logger.info(`/ping used by ${interaction.user.tag} - Latency: ${latency}ms`);
}

/**
 * Gestisce il comando /uptime
 */
async function handleUptime(interaction) {
    const uptime = interaction.client.startTime ? Date.now() - interaction.client.startTime.getTime() : 0;
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
    
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    await interaction.reply({ content: `**⏱️ Uptime**: ${uptimeStr}`, ephemeral: true });
    logger.info(`/uptime used by ${interaction.user.tag} - Uptime: ${uptimeStr}`);
}

/**
 * Gestisce il comando /purge
 */
async function handlePurge(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.ManageMessages)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const limit = interaction.options.getInteger('limit');

    if (limit < 1 || limit > 250) {
        await interaction.reply({ content: '❌ Puoi scegliere numeri tra 1 e 250.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const messages = await interaction.channel.messages.fetch({ limit, before: interaction.id });
        await interaction.channel.bulkDelete(messages);

        await interaction.followUp({
            content: `✅ Ho eliminato ${messages.size} messaggi.`,
            ephemeral: true
        });

        logger.info(`Purge executed: ${messages.size} messages deleted by ${interaction.user.tag} in ${interaction.channel.name}`);
    } catch (error) {
        await interaction.followUp({
            content: `❌ Errore durante la purge: ${error.message}`,
            ephemeral: true
        });

        logger.error(`Purge error by ${interaction.user.tag}: ${error.message}`);
    }
}

module.exports = { handlePing, handleUptime, handlePurge };
