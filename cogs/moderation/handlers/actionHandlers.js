const { PermissionFlagsBits } = require('discord.js');
const { ownerOrHasPermissions } = require('../../../utils/botUtils');
const { createModerationEmbed, createErrorEmbed } = require('../services/embedBuilder');
const { parseDuration, formatDuration } = require('../services/durationParser');
const { MESSAGES, PERMISSION_MAP, MODULE_NAME } = require('../constants');
const logger = require('../../../utils/logger');

async function handleBan(interaction) {
    if (!ownerOrHasPermissions(PERMISSION_MAP.ban)(interaction)) {
        return interaction.reply({
            content: MESSAGES.ERROR.NO_PERMISSION,
            ephemeral: true
        });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || MESSAGES.INFO.NO_REASON;

    if (!user) {
        return interaction.reply({
            content: MESSAGES.ERROR.INVALID_USER,
            ephemeral: true
        });
    }

    if (user.id === interaction.user.id) {
        return interaction.reply({
            content: MESSAGES.ERROR.CANNOT_ACTION_SELF,
            ephemeral: true
        });
    }

    if (user.bot) {
        return interaction.reply({
            content: MESSAGES.ERROR.CANNOT_ACTION_BOT,
            ephemeral: true
        });
    }

    try {
        await interaction.guild.members.ban(user, { reason });

        const embed = createModerationEmbed({
            action: 'ban',
            target: user,
            moderator: interaction.user,
            reason,
            additionalFields: {
                '🔨 Action': 'Permanent Ban',
                '🆔 User ID': user.id
            }
        });

        await interaction.reply({ embeds: [embed] });

        logger.info(`[${MODULE_NAME}] ${user.tag} (${user.id}) banned by ${interaction.user.tag}: ${reason}`);
    } catch (error) {
        logger.error(`[${MODULE_NAME}] Ban failed:`, error);

        const errorMessage = MESSAGES.ERROR.OPERATION_FAILED
            .replace('{action}', 'Ban')
            .replace('{error}', error.message);

        await interaction.reply({
            content: errorMessage,
            ephemeral: true
        });
    }
}

async function handleUnban(interaction) {
    if (!ownerOrHasPermissions(PERMISSION_MAP.unban)(interaction)) {
        return interaction.reply({
            content: MESSAGES.ERROR.NO_PERMISSION,
            ephemeral: true
        });
    }

    const userId = interaction.options.getString('id');
    const reason = interaction.options.getString('reason') || MESSAGES.INFO.NO_REASON;

    if (!userId) {
        return interaction.reply({
            content: MESSAGES.ERROR.INVALID_USER,
            ephemeral: true
        });
    }

    try {
        const bans = await interaction.guild.bans.fetch();
        const bannedUser = bans.get(userId);

        if (!bannedUser) {
            return interaction.reply({
                content: MESSAGES.ERROR.USER_NOT_BANNED,
                ephemeral: true
            });
        }

        await interaction.guild.bans.remove(userId, reason);

        const embed = createModerationEmbed({
            action: 'unban',
            target: bannedUser.user,
            moderator: interaction.user,
            reason,
            additionalFields: {
                '♻️ Action': 'Ban Removed',
                '🆔 User ID': userId,
                '📅 Original Ban Reason': bannedUser.reason || 'Not specified'
            }
        });

        await interaction.reply({ embeds: [embed] });

        logger.info(`[${MODULE_NAME}] User ${userId} unbanned by ${interaction.user.tag}: ${reason}`);
    } catch (error) {
        logger.error(`[${MODULE_NAME}] Unban failed:`, error);

        const errorMessage = MESSAGES.ERROR.OPERATION_FAILED
            .replace('{action}', 'Unban')
            .replace('{error}', error.message);

        await interaction.reply({
            content: errorMessage,
            ephemeral: true
        });
    }
}

async function handleUnbanAutocomplete(interaction) {
    const focused = interaction.options.getFocused();

    try {
        const bans = await interaction.guild.bans.fetch();

        let choices = bans.map(ban => ({
            name: `${ban.user.tag} (${ban.user.id})`,
            value: ban.user.id
        }));

        if (focused && focused.length > 0) {
            const query = focused.toLowerCase();
            choices = choices.filter(choice =>
                choice.value.includes(query) ||
                choice.name.toLowerCase().includes(query)
            );
        }

        choices = choices.slice(0, 25);

        await interaction.respond(choices);
    } catch (error) {
        logger.error(`[${MODULE_NAME}] Unban autocomplete error:`, error);

        if (!interaction.responded) {
            await interaction.respond([]);
        }
    }
}

async function handleKick(interaction) {
    if (!ownerOrHasPermissions(PERMISSION_MAP.kick)(interaction)) {
        return interaction.reply({
            content: MESSAGES.ERROR.NO_PERMISSION,
            ephemeral: true
        });
    }

    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || MESSAGES.INFO.NO_REASON;

    if (!member) {
        return interaction.reply({
            content: MESSAGES.ERROR.INVALID_USER,
            ephemeral: true
        });
    }

    if (member.id === interaction.user.id) {
        return interaction.reply({
            content: MESSAGES.ERROR.CANNOT_ACTION_SELF,
            ephemeral: true
        });
    }

    if (member.user.bot) {
        return interaction.reply({
            content: MESSAGES.ERROR.CANNOT_ACTION_BOT,
            ephemeral: true
        });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
            content: MESSAGES.ERROR.HIERARCHY_ERROR,
            ephemeral: true
        });
    }

    try {
        await member.kick(reason);

        const embed = createModerationEmbed({
            action: 'kick',
            target: member.user,
            moderator: interaction.user,
            reason,
            additionalFields: {
                '👢 Action': 'Kicked from Server',
                '🆔 User ID': member.id
            }
        });

        await interaction.reply({ embeds: [embed] });

        logger.info(`[${MODULE_NAME}] ${member.user.tag} (${member.id}) kicked by ${interaction.user.tag}: ${reason}`);
    } catch (error) {
        logger.error(`[${MODULE_NAME}] Kick failed:`, error);

        const errorMessage = MESSAGES.ERROR.OPERATION_FAILED
            .replace('{action}', 'Kick')
            .replace('{error}', error.message);

        await interaction.reply({
            content: errorMessage,
            ephemeral: true
        });
    }
}

async function handleMute(interaction) {
    if (!ownerOrHasPermissions(PERMISSION_MAP.mute)(interaction)) {
        return interaction.reply({
            content: MESSAGES.ERROR.NO_PERMISSION,
            ephemeral: true
        });
    }

    const member = interaction.options.getMember('user');
    const durationStr = interaction.options.getString('duration') || '10m';
    const reason = interaction.options.getString('reason') || MESSAGES.INFO.NO_REASON;

    if (!member) {
        return interaction.reply({
            content: MESSAGES.ERROR.INVALID_USER,
            ephemeral: true
        });
    }

    if (member.id === interaction.user.id) {
        return interaction.reply({
            content: MESSAGES.ERROR.CANNOT_ACTION_SELF,
            ephemeral: true
        });
    }

    if (member.user.bot) {
        return interaction.reply({
            content: MESSAGES.ERROR.CANNOT_ACTION_BOT,
            ephemeral: true
        });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
            content: MESSAGES.ERROR.HIERARCHY_ERROR,
            ephemeral: true
        });
    }

    try {
        const durationMs = parseDuration(durationStr);
        const formattedDuration = formatDuration(durationMs);

        await member.timeout(durationMs, reason);

        const embed = createModerationEmbed({
            action: 'mute',
            target: member.user,
            moderator: interaction.user,
            reason,
            additionalFields: {
                '⏱️ Duration': formattedDuration,
                '🆔 User ID': member.id,
                '⏰ Expires': `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`
            }
        });

        await interaction.reply({ embeds: [embed] });

        logger.info(`[${MODULE_NAME}] ${member.user.tag} (${member.id}) muted for ${formattedDuration} by ${interaction.user.tag}: ${reason}`);
    } catch (error) {
        logger.error(`[${MODULE_NAME}] Mute failed:`, error);

        const errorMessage = MESSAGES.ERROR.OPERATION_FAILED
            .replace('{action}', 'Mute')
            .replace('{error}', error.message);

        await interaction.reply({
            content: errorMessage,
            ephemeral: true
        });
    }
}

async function handleUnmute(interaction) {
    if (!ownerOrHasPermissions(PERMISSION_MAP.unmute)(interaction)) {
        return interaction.reply({
            content: MESSAGES.ERROR.NO_PERMISSION,
            ephemeral: true
        });
    }

    const member = interaction.options.getMember('user');

    if (!member) {
        return interaction.reply({
            content: MESSAGES.ERROR.INVALID_USER,
            ephemeral: true
        });
    }

    try {
        await member.timeout(null);

        const embed = createModerationEmbed({
            action: 'unmute',
            target: member.user,
            moderator: interaction.user,
            reason: 'Timeout manually removed',
            additionalFields: {
                '🔊 Action': 'Timeout Removed',
                '🆔 User ID': member.id
            }
        });

        await interaction.reply({ embeds: [embed] });

        logger.info(`[${MODULE_NAME}] ${member.user.tag} (${member.id}) unmuted by ${interaction.user.tag}`);
    } catch (error) {
        logger.error(`[${MODULE_NAME}] Unmute failed:`, error);

        const errorMessage = MESSAGES.ERROR.OPERATION_FAILED
            .replace('{action}', 'Unmute')
            .replace('{error}', error.message);

        await interaction.reply({
            content: errorMessage,
            ephemeral: true
        });
    }
}

async function handleNick(interaction) {
    if (!ownerOrHasPermissions(PERMISSION_MAP.nick)(interaction)) {
        return interaction.reply({
            content: MESSAGES.ERROR.NO_PERMISSION,
            ephemeral: true
        });
    }

    const member = interaction.options.getMember('user');
    const nickname = interaction.options.getString('nick');

    if (!member) {
        return interaction.reply({
            content: MESSAGES.ERROR.INVALID_USER,
            ephemeral: true
        });
    }

    if (nickname.length > 32) {
        return interaction.reply({
            content: MESSAGES.ERROR.NICKNAME_TOO_LONG,
            ephemeral: true
        });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
            content: MESSAGES.ERROR.HIERARCHY_ERROR,
            ephemeral: true
        });
    }

    try {
        const oldNick = member.nickname || member.user.username;

        await member.setNickname(nickname);

        const successMessage = MESSAGES.SUCCESS.NICK_CHANGED
            .replace('{user}', member.user.tag)
            .replace('{nick}', nickname);

        await interaction.reply({
            content: successMessage,
            ephemeral: false
        });

        logger.info(`[${MODULE_NAME}] Nickname changed for ${member.user.tag} (${member.id}): "${oldNick}" → "${nickname}" by ${interaction.user.tag}`);
    } catch (error) {
        logger.error(`[${MODULE_NAME}] Nickname change failed:`, error);

        const errorMessage = MESSAGES.ERROR.OPERATION_FAILED
            .replace('{action}', 'Nickname Change')
            .replace('{error}', error.message);

        await interaction.reply({
            content: errorMessage,
            ephemeral: true
        });
    }
}

module.exports = {
    handleBan,
    handleUnban,
    handleUnbanAutocomplete,
    handleKick,
    handleMute,
    handleUnmute,
    handleNick
};
