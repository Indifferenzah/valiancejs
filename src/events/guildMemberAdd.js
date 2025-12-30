const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { getConfig } = require('../core/config');
const { recentWelcomes } = require('../state/sessionState');

/**
 * Handler per l'evento guildMemberAdd
 */
async function onGuildMemberAdd(client, member) {
    if (recentWelcomes.has(member.id)) return;
    recentWelcomes.add(member.id);
    setTimeout(() => recentWelcomes.delete(member.id), 10000);
    
    const config = getConfig();
    
    try {
        const joinRoleId = config.autorole_on_join_id;
        if (joinRoleId) {
            const role = member.guild.roles.cache.get(joinRoleId);
            if (role && !member.roles.cache.has(role.id)) {
                await member.roles.add(role, 'Auto-role on join (config)');
            }
        }
    } catch (error) {
        if (error.code !== 50013) {
            logger.error(`Error assigning autorole on join: ${error.message}`);
        }
    }

    if (!config.welcome_channel_id) return;

    try {
        const welcomeChannel = member.guild.channels.cache.get(config.welcome_channel_id);
        if (!welcomeChannel) return;

        const welcomeData = config.welcome_message || {};
    
        let description = welcomeData.description || '{mention}, benvenuto/a!';
        description = description.replace('{mention}', member.toString())
            .replace('{username}', member.user.username)
            .replace('{user}', member.user.username);

        const embed = new EmbedBuilder()
            .setTitle(welcomeData.title || 'Nuovo membro!')
            .setDescription(description)
            .setColor(welcomeData.color || 0x3447003);

        const thumbnail = welcomeData.thumbnail || '{avatar}';
        if (thumbnail.includes('{avatar}')) {
            embed.setThumbnail(member.user.displayAvatarURL());
        } else if (thumbnail) {
            embed.setThumbnail(thumbnail);
        }

        if (welcomeData.footer) {
            embed.setFooter({ text: welcomeData.footer });
        }

        embed.setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() });

        const pingMessage = welcomeData.ping_message;
        if (pingMessage) {
            const finalPingMessage = pingMessage.replace('{mention}', member.toString())
                .replace('{username}', member.user.username)
                .replace('{user}', member.user.username);
            await welcomeChannel.send({ content: finalPingMessage, embeds: [embed] });
        } else {
            await welcomeChannel.send({ embeds: [embed] });
        }

        logger.info(`Welcome message sent for ${member.user.username}`);
    } catch (error) {
        logger.error(`Error sending welcome message: ${error.message}`);
    }
}

module.exports = { onGuildMemberAdd };
