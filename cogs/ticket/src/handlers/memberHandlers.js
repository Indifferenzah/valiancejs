const { EmbedBuilder } = require('discord.js');
const logger = require('../../../../utils/logger');
const { MODULE_NAME } = require('../../constants');
const store = require('../services/ticketStore');

/**
 * Fired when a guild member leaves.
 * Sends an alert embed in every open ticket owned by that user.
 * The embed is configured via the "member_left" key in ticketmsg.json.
 */
async function handleMemberLeave(member) {
    const openTickets = store.getOpenTicketsByUser(member.id);
    if (openTickets.length === 0) return;

    const msgConfig = store.ticketMessages.member_left;
    if (!msgConfig) return;

    const vars = {
        '{mention}': member.toString(),
        '{tag}':     member.user.tag || member.user.username,
        '{id}':      member.id,
    };

    const applyVars = (str) =>
        str ? Object.entries(vars).reduce((acc, [k, v]) => acc.replace(k, v), str) : str;

    const embed = new EmbedBuilder()
        .setTitle(applyVars(msgConfig.title))
        .setDescription(applyVars(msgConfig.description))
        .setColor(msgConfig.color || 0xff0000);

    if (msgConfig.thumbnail) embed.setThumbnail(msgConfig.thumbnail);
    if (msgConfig.footer)    embed.setFooter({ text: applyVars(msgConfig.footer) });

    for (const [channelId] of openTickets) {
        const channel = member.client.channels.cache.get(channelId);
        if (!channel) continue;
        await channel.send({ embeds: [embed] }).catch(err =>
            logger.error(`[${MODULE_NAME}] Could not send member_left alert to ${channelId}: ${err.message}`)
        );
    }
}

module.exports = { handleMemberLeave };
