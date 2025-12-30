const { EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../../../utils/logger');
const { ownerOrHasPermissions } = require('../../../utils/botUtils');
const { getConfig } = require('../../core/config');

/**
 * Gestisce il context menu Force Verify
 */
async function handleForceVerifyContext(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        return interaction.reply({
            content: '❌ Non hai abbastanza permessi.',
            ephemeral: true
        });
    }

    const member = interaction.targetMember;
    if (!member) {
        return interaction.reply({
            content: '❌ Utente non valido.',
            ephemeral: true
        });
    }

    const config = getConfig();
    const addRoleId = config.verify_add_role_id;
    const removeRoleId = config.verify_remove_role_id;

    if (!addRoleId && !removeRoleId) {
        return interaction.reply({
            content: '⚠️ Ruoli di verifica non configurati.',
            ephemeral: true
        });
    }

    let added = false;
    let removed = false;

    if (addRoleId) {
        const role = interaction.guild.roles.cache.get(addRoleId);
        if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role, `Force verify by ${interaction.user.tag}`);
            added = true;
        }
    }

    if (removeRoleId) {
        const role = interaction.guild.roles.cache.get(removeRoleId);
        if (role && member.roles.cache.has(role.id)) {
            await member.roles.remove(role, `Force verify by ${interaction.user.tag}`);
            removed = true;
        }
    }

    let msg = `✅ Verifica forzata completata per ${member}.`;
    if (added && removed) msg = `✅ ${member} verificato forzatamente.`;
    else if (added || removed) msg = `⚠️ Azione parziale completata su ${member}.`;

    await interaction.reply({ content: msg, ephemeral: true });
    logger.info(`ForceVerify (context) by ${interaction.user.tag} on ${member.user.tag}`);
}

/**
 * Gestisce il comando /verify
 */
async function handleVerify(interaction) {
    const config = getConfig();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'panel') {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
            return;
        }

        try {
            const vmsg = config.verify_message || {};
            const title = vmsg.title || 'Verifica l\'accesso';
            const description = vmsg.description || 'Clicca il pulsante qui sotto per verificarti.';
            const color = vmsg.color || 0x2ecc71;

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color);

            if (vmsg.thumbnail) embed.setThumbnail(vmsg.thumbnail);
            if (vmsg.footer) embed.setFooter({ text: vmsg.footer });
            if (vmsg.image) embed.setImage(vmsg.image);

            const VerifyView = require('../../../views/VerifyView');
            const view = new VerifyView(config);

            await interaction.reply({ embeds: [embed], components: view.components });
            logger.info(`/verify panel used by ${interaction.user.tag} in ${interaction.guild.name}`);
        } catch (error) {
            await interaction.reply({ content: `❌ Errore: ${error.message}`, ephemeral: true });
            logger.error(`Error in /verify panel: ${error.message}`);
        }
    } else if (subcommand === 'forceverify') {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
            return;
        }

        const member = interaction.options.getMember('member');
    
        try {
            const addRoleId = config.verify_add_role_id;
            const removeRoleId = config.verify_remove_role_id;

            let added = false, removed = false;

            if (addRoleId) {
                const role = interaction.guild.roles.cache.get(addRoleId);
                if (role && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role, `Force verify by ${interaction.user.tag}`);
                    added = true;
                }
            }

            if (removeRoleId) {
                const role = interaction.guild.roles.cache.get(removeRoleId);
                if (role && member.roles.cache.has(role.id)) {
                    await member.roles.remove(role, `Force verify by ${interaction.user.tag}`);
                    removed = true;
                }
            }

            if (!addRoleId && !removeRoleId) {
                await interaction.reply({ content: '⚠️ Ruoli di verifica non configurati.', ephemeral: true });
                return;
            }

            let msg = `✅ Verifica forzata completata per ${member.toString()}.`;
            if (added && removed) {
                msg = `✅ ${member.toString()} verificato forzatamente.`;
            } else if (added) {
                msg = `⚠️ Ruolo aggiunto a ${member.toString()}, ma verifica incompleta.`;
            } else if (removed) {
                msg = `⚠️ Ruolo rimosso da ${member.toString()}, ma verifica incompleta.`;
            }

            await interaction.reply({ content: msg, ephemeral: true });
            logger.info(`/verify forceverify used by ${interaction.user.tag} on ${member.user.tag}`);
        } catch (error) {
            await interaction.reply({ content: `❌ Errore: ${error.message}`, ephemeral: true });
            logger.error(`Error in /verify forceverify: ${error.message}`);
        }
    }
}

module.exports = { handleVerify, handleForceVerifyContext };
