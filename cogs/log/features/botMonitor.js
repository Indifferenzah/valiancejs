'use strict';

const { EmbedBuilder } = require('discord.js');
const logger = require('../../../utils/logger');

/**
 * Feature 22: Bot Monitor
 * Monitora lo stato del bot: startup, errori critici, comandi usati
 */

/**
 * Invia un embed quando il bot si avvia
 * @param {Client} client
 * @param {string} logChannelId
 */
async function logBotReady(client, logChannelId) {
    try {
        if (!logChannelId) return;

        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ Bot Online')
            .setDescription(`**${client.user.tag}** è ora online e operativo!`)
            .addFields(
                { name: 'Server', value: client.guilds.cache.size.toString(), inline: true },
                { name: 'Utenti', value: totalMembers.toString(), inline: true },
                { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: 'Node.js', value: process.version, inline: true },
                { name: 'Uptime', value: '0s', inline: true },
                { name: 'Avviato il', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .setTimestamp()
            .setFooter({ text: 'Valiance Bot Monitor' });

        await channel.send({ embeds: [embed] });
        logger.info('[BotMonitor] Bot ready log inviato');
    } catch (err) {
        logger.error('[BotMonitor] Errore logBotReady:', err);
    }
}

/**
 * Invia un embed su un errore critico
 * @param {Error} error
 * @param {string} context - descrizione del contesto
 * @param {string} logChannelId
 * @param {Client} client
 */
async function logBotError(error, context, logChannelId, client) {
    try {
        if (!logChannelId || !client) return;

        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor('#F04747')
            .setTitle('❌ Errore Critico')
            .setDescription(`Si è verificato un errore critico nel bot`)
            .addFields(
                { name: 'Contesto', value: context || 'Sconosciuto', inline: false },
                { name: 'Errore', value: error?.message?.substring(0, 1024) || 'Sconosciuto', inline: false },
                { name: 'Stack', value: error?.stack ? error.stack.substring(0, 1024) : 'N/A', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Valiance Bot Monitor | Errore' });

        await channel.send({ embeds: [embed] });
    } catch (err) {
        logger.error('[BotMonitor] Errore logBotError:', err);
    }
}

/**
 * Logga l'uso di un comando slash
 * @param {CommandInteraction} interaction
 * @param {string} logChannelId
 * @param {Client} client
 */
async function logCommandUsed(interaction, logChannelId, client) {
    try {
        if (!logChannelId || !client) return;
        if (!interaction.isCommand()) return;

        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        // Raccoglie le opzioni del comando
        const options = interaction.options?.data?.map(opt =>
            `${opt.name}: ${opt.value ?? (opt.user?.tag || opt.channel?.name || opt.role?.name || 'N/A')}`
        ).join('\n') || 'Nessuna';

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚡ Comando Usato')
            .addFields(
                { name: 'Utente', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
                { name: 'Comando', value: `\`/${interaction.commandName}\``, inline: true },
                { name: 'Server', value: interaction.guild?.name || 'DM', inline: true },
                { name: 'Canale', value: interaction.channel ? `<#${interaction.channel.id}>` : 'N/A', inline: true },
                { name: 'Opzioni', value: options.substring(0, 1024), inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `ID Interazione: ${interaction.id}` });

        await channel.send({ embeds: [embed] });
    } catch (err) {
        logger.error('[BotMonitor] Errore logCommandUsed:', err);
    }
}

module.exports = { logBotReady, logBotError, logCommandUsed };
