const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');

class VerifyView {
    constructor(config) {
        this.config = config;
        this.components = this.createComponents();
    }

    createComponents() {
        const btnCfg = this.config.verify_button || {};
        const customId = btnCfg.id || 'verify_button';
        const label = btnCfg.label || 'Verificati';
        const emoji = btnCfg.emoji;
        const styleStr = (btnCfg.style || 'success').toLowerCase();
        
        const styleMap = {
            'primary': ButtonStyle.Primary,
            'secondary': ButtonStyle.Secondary,
            'success': ButtonStyle.Success,
            'danger': ButtonStyle.Danger,
            'link': ButtonStyle.Link
        };
        
        const style = styleMap[styleStr] || ButtonStyle.Success;
        
        const button = new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(label)
            .setStyle(style)
            .setDisabled(style === ButtonStyle.Link);
            
        if (emoji) {
            button.setEmoji(emoji);
        }

        const row = new ActionRowBuilder().addComponents(button);
        return [row];
    }

    async handleVerifyClick(interaction) {
        try {
            const guild = interaction.guild;
            if (!guild) {
                await interaction.reply({ content: '❌ Questo pulsante può essere usato solo in un server.', ephemeral: true });
                return;
            }

            const member = interaction.member;
            if (!member) {
                await interaction.reply({ content: '❌ Impossibile determinare il membro.', ephemeral: true });
                return;
            }

            const addRoleId = this.config.verify_add_role_id;
            const removeRoleId = this.config.verify_remove_role_id;

            const addRole = addRoleId ? guild.roles.cache.get(addRoleId) : null;
            const removeRole = removeRoleId ? guild.roles.cache.get(removeRoleId) : null;

            // Check if already verified
            if (addRole && member.roles.cache.has(addRole.id) && (!removeRole || !member.roles.cache.has(removeRole.id))) {
                await interaction.reply({ content: '✅ Sei già verificato.', ephemeral: true });
                return;
            }

            let added = false, removed = false;

            // Add verification role
            if (addRole && !member.roles.cache.has(addRole.id)) {
                try {
                    await member.roles.add(addRole, 'Verifica tramite pulsante');
                    added = true;
                } catch (error) {
                    if (error.code === 50013) {
                        await interaction.reply({ content: '❌ Non ho i permessi per assegnare il ruolo, contatta `@indifferenzah`.', ephemeral: true });
                        return;
                    }
                    throw error;
                }
            }

            // Remove unverified role
            if (removeRole && member.roles.cache.has(removeRole.id)) {
                try {
                    await member.roles.remove(removeRole, 'Verifica tramite pulsante');
                    removed = true;
                } catch (error) {
                    if (error.code === 50013) {
                        await interaction.reply({ content: '❌ Non ho i permessi per rimuovere il ruolo, contatta `@indifferenzah`.', ephemeral: true });
                        return;
                    }
                    throw error;
                }
            }

            if (!addRoleId && !removeRoleId) {
                await interaction.reply({ content: '⚠️ Ruoli di verifica non configurati. Contatta `@indifferenzah`.', ephemeral: true });
                return;
            }

            let msg = '✅ Verifica completata.';
            if (added && removed) {
                msg = '✅ Verificato.';
            } else if (added) {
                msg = '⚠️ Verifica non completata, contatta `@indifferenzah`.';
            } else if (removed) {
                msg = '⚠️ Verifica non completata, contatta `@indifferenzah`.';
            }

            await interaction.reply({ content: msg, ephemeral: true });
            logger.info(`User ${member.user.tag} verified via button`);
        } catch (error) {
            try {
                await interaction.reply({ content: `❌ Errore durante la verifica, contatta \`@indifferenzah\`: ${error.message}`, ephemeral: true });
            } catch (replyError) {
                logger.error(`Failed to send error reply: ${replyError.message}`);
            }
            logger.error(`Error in verify button: ${error.message}`);
        }
    }
}

module.exports = VerifyView;