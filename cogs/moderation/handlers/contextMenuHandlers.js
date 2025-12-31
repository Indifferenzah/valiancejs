const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');
const { ownerOrHasPermissions } = require('../../../utils/botUtils');
const { parseDuration } = require('../services/durationParser');
const { MESSAGES, PERMISSION_MAP, MODULE_NAME } = require('../constants');
const logger = require('../../../utils/logger');

async function handleUserContext(interaction) {
    const action = interaction.commandName.toLowerCase();
    const target = interaction.targetMember;

    if (!target) {
        return interaction.reply({
            content: MESSAGES.ERROR.INVALID_USER,
            ephemeral: true
        });
    }

    const neededPermission = PERMISSION_MAP[action];

    if (neededPermission && !ownerOrHasPermissions(neededPermission)(interaction)) {
        return interaction.reply({
            content: MESSAGES.ERROR.NO_PERMISSION,
            ephemeral: true
        });
    }

    if (target.id === interaction.user.id) {
        return interaction.reply({
            content: MESSAGES.ERROR.CANNOT_ACTION_SELF,
            ephemeral: true
        });
    }

    if (target.user.bot) {
        return interaction.reply({
            content: MESSAGES.ERROR.CANNOT_ACTION_BOT,
            ephemeral: true
        });
    }

    if ((action === 'kick' || action === 'timeout') &&
        target.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
            content: MESSAGES.ERROR.HIERARCHY_ERROR,
            ephemeral: true
        });
    }

    try {
        const modal = buildModerationModal(action, target);

        await interaction.showModal(modal);

        logger.debug(`[${MODULE_NAME}] Context menu modal shown for ${action} on ${target.user.tag}`);
    } catch (error) {
        logger.error(`[${MODULE_NAME}] Context menu error:`, error);

        if (!interaction.replied) {
            await interaction.reply({
                content: MESSAGES.ERROR.INTERNAL,
                ephemeral: true
            });
        }
    }
}

function buildModerationModal(action, target) {
    const modal = new ModalBuilder()
        .setCustomId(`mod_${action}_${target.id}`)
        .setTitle(`${capitalizeFirst(action)} — ${target.user.username}`);

    const components = [];

    if (action === 'timeout') {
        const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Durata (es: 10m, 1h, 1d)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('10m')
            .setRequired(true)
            .setMaxLength(10);

        components.push(new ActionRowBuilder().addComponents(durationInput));
    }

    const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Motivo')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Spiega il motivo di questa azione di moderazione...')
        .setRequired(false)
        .setMaxLength(500);

    components.push(new ActionRowBuilder().addComponents(reasonInput));

    modal.addComponents(...components);

    return modal;
}

async function handleModerationModal(interaction) {
    const customIdParts = interaction.customId.split('_');
    
    if (customIdParts[0] === 'ticket') {
        return;
    }

    const action = customIdParts[1];
    const userId = customIdParts[2];

    // Fetch the target member
    const member = await interaction.guild.members.fetch(userId).catch(() => null);

    if (!member) {
        return interaction.reply({
            content: MESSAGES.ERROR.INVALID_USER,
            ephemeral: true
        });
    }

    // Extract reason from modal
    let reason = MESSAGES.INFO.NO_REASON;
    if (interaction.fields.fields.has('reason')) {
        const reasonInput = interaction.fields.getTextInputValue('reason').trim();
        if (reasonInput) {
            reason = reasonInput;
        }
    }

    // Permission validation
    const neededPermission = PERMISSION_MAP[action];
    if (neededPermission && !ownerOrHasPermissions(neededPermission)(interaction)) {
        return interaction.reply({
            content: MESSAGES.ERROR.NO_PERMISSION,
            ephemeral: true
        });
    }

    try {
        // Execute the action
        switch (action) {
            case 'ban':
                await member.ban({ reason });
                break;

            case 'kick':
                await member.kick(reason);
                break;

            case 'timeout':
                // Extract and parse duration
                if (!interaction.fields.fields.has('duration')) {
                    return interaction.reply({
                        content: MESSAGES.ERROR.MISSING_DURATION,
                        ephemeral: true
                    });
                }

                const durationInput = interaction.fields.getTextInputValue('duration').trim();
                const durationMs = parseDuration(durationInput);

                await member.timeout(durationMs, reason);
                break;

            default:
                return interaction.reply({
                    content: MESSAGES.ERROR.INTERNAL,
                    ephemeral: true
                });
        }

        // Send success message
        const successMessage = MESSAGES.SUCCESS.ACTION_COMPLETED
            .replace('{action}', action.toUpperCase())
            .replace('{user}', member.user.tag);

        await interaction.reply({
            content: successMessage,
            ephemeral: true
        });

        logger.info(`[${MODULE_NAME}] ${action.toUpperCase()} executed on ${member.user.tag} (${member.id}) by ${interaction.user.tag} via context menu: ${reason}`);
    } catch (error) {
        logger.error(`[${MODULE_NAME}] Modal action failed:`, error);

        const errorMessage = MESSAGES.ERROR.OPERATION_FAILED
            .replace('{action}', capitalizeFirst(action))
            .replace('{error}', error.message);

        if (!interaction.replied) {
            await interaction.reply({
                content: errorMessage,
                ephemeral: true
            });
        }
    }
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
    handleUserContext,
    handleModerationModal,
    buildModerationModal
};
