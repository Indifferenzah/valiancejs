const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { getConfig } = require('../core/config');

/**
 * Handler per l'evento guildMemberUpdate
 */
async function onGuildMemberUpdate(client, oldMember, newMember) {
    const firstBoost = !oldMember.premiumSince && newMember.premiumSince;
    const boostUpgrade = oldMember.premiumTier !== newMember.premiumTier;

    if (!firstBoost && !boostUpgrade) return;

    const config = getConfig();
    if (!config.boost_channel_id) return;

    try {
        const boostChannel = newMember.guild.channels.cache.get(config.boost_channel_id);
        if (!boostChannel) return;

        const boostData = config.boost_message || {};
    
        let description = boostData.description || '{mention} ha boostato il server!';
        description = description
            .replace('{mention}', newMember.toString())
            .replace('{username}', newMember.user.username)
            .replace('{user}', newMember.user.username);

        const embed = new EmbedBuilder()
            .setTitle(boostData.title || 'Nuovo Boost!')
            .setDescription(description)
            .setColor(boostData.color || 0xFFD700);

        const thumbnail = boostData.thumbnail || '{avatar}';
        if (thumbnail.includes('{avatar}')) {
            embed.setThumbnail(newMember.user.displayAvatarURL());
        } else if (thumbnail) {
            embed.setThumbnail(thumbnail);
        }

        if (boostData.footer) {
            embed.setFooter({ text: boostData.footer });
        }

        embed.setAuthor({
            name: newMember.user.username,
            iconURL: newMember.user.displayAvatarURL()
        });

        const pingMessage = boostData.ping_message;
        let finalPingMessage = null;

        if (pingMessage) {
            finalPingMessage = pingMessage
                .replace('{mention}', newMember.toString())
                .replace('{username}', newMember.user.username)
                .replace('{user}', newMember.user.username);
        }

        await boostChannel.send({
            content: finalPingMessage || null,
            embeds: [embed]
        });
        logger.info(`Boost message sent for ${newMember.user.username}`);

    } catch (error) {
        logger.error(`Error sending boost message: ${error.message}`);
    }
}

module.exports = { onGuildMemberUpdate };
