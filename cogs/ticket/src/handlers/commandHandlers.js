const { PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../../../../utils/botUtils');
const logger = require('../../../../utils/logger');
const { MODULE_NAME, MESSAGES } = require('../../constants');
const store = require('../services/ticketStore');
const {
    buildPanelEmbed,
    buildButtonRows,
    buildConfirmCloseEmbed,
    buildConfirmCloseRow,
    buildListEmbed,
    buildTicketMsgEmbed,
    buildTranscriptEmbed,
} = require('../services/embedBuilder');

// ── Permission helpers ─────────────────────────────────────────────────────

function isStaff(member) {
    const staffRoleId = store.config.ticket_staff_role_id;
    return Boolean(staffRoleId && member.roles.cache.has(staffRoleId));
}

function hasAdminOrOwner(interaction) {
    return isOwner(interaction.user) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);
}

// ── Handlers ───────────────────────────────────────────────────────────────

async function handleTicketPanel(interaction) {
    if (!isOwner(interaction.user)) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
    }

    const allButtons     = store.config.ticket_buttons || [];
    const userRoleIds    = interaction.member.roles.cache.map(r => r.id);
    const visibleButtons = allButtons.filter(btn => {
        const roles = btn.roles || [];
        return roles.length === 0 || roles.some(id => userRoleIds.includes(id));
    });

    const message = await interaction.channel.send({
        embeds:     [buildPanelEmbed(store.config)],
        components: buildButtonRows(visibleButtons),
    });

    store.config.ticket_panel_channel_id = interaction.channel.id;
    store.config.ticket_panel_message_id = message.id;
    store.saveConfig();

    await interaction.reply({ content: MESSAGES.SUCCESS.PANEL_CREATED, ephemeral: true });
}

async function handleClose(interaction) {
    if (!store.getTicket(interaction.channel.id)) {
        return interaction.reply({ content: MESSAGES.ERROR.NOT_A_TICKET, ephemeral: true });
    }
    if (!isStaff(interaction.member)) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
    }
    await interaction.reply({
        embeds:     [buildConfirmCloseEmbed()],
        components: [buildConfirmCloseRow()],
        ephemeral:  true,
    });
}

async function handleRename(interaction) {
    const { channel } = interaction;
    const newName = interaction.options.getString('nome');

    if (!store.getTicket(channel.id)) {
        return interaction.reply({ content: MESSAGES.ERROR.NOT_A_TICKET, ephemeral: true });
    }
    if (!isStaff(interaction.member)) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
    }
    if (newName.length > 100) {
        return interaction.reply({ content: MESSAGES.ERROR.NAME_TOO_LONG, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: false });
    try {
        await channel.setName(newName);
        const msg = store.ticketMessages.rename;
        if (msg) {
            await interaction.followUp({ embeds: [buildTicketMsgEmbed(msg, { '{name}': newName })], ephemeral: false });
        } else {
            await interaction.followUp({ content: MESSAGES.SUCCESS.CHANNEL_RENAMED, ephemeral: false });
        }
    } catch (err) {
        const content = err.code === 50013
            ? MESSAGES.ERROR.PERM_RENAME
            : MESSAGES.ERROR.RENAME_FAILED.replace('{error}', err.message);
        await interaction.followUp({ content, ephemeral: true });
    }
}

async function handleBlacklist(interaction) {
    if (!isStaff(interaction.member)) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
        const user = interaction.options.getUser('user');
        if (store.isBlacklisted(user.id)) {
            return interaction.reply({ content: `⚠️ ${user} è già nella blacklist!`, ephemeral: true });
        }
        store.toggleBlacklist(user.id);
        return interaction.reply({ content: MESSAGES.SUCCESS.BLACKLIST_ADDED.replace('{member}', user.toString()), ephemeral: true });
    }

    if (sub === 'remove') {
        const user = interaction.options.getUser('user');
        if (!store.isBlacklisted(user.id)) {
            return interaction.reply({ content: `⚠️ ${user} non è nella blacklist!`, ephemeral: true });
        }
        store.toggleBlacklist(user.id);
        return interaction.reply({ content: MESSAGES.SUCCESS.BLACKLIST_REMOVED.replace('{member}', user.toString()), ephemeral: true });
    }

    if (sub === 'list') {
        const list = store.getBlacklist();
        if (list.length === 0) {
            return interaction.reply({ content: '📋 La blacklist è vuota.', ephemeral: true });
        }
        const mentions = list.map(id => `<@${id}>`).join('\n');
        return interaction.reply({ content: `📋 **Blacklist (${list.length}):**\n${mentions}`, ephemeral: true });
    }
}

async function handleAdd(interaction) {
    const { channel } = interaction;
    if (!store.getTicket(channel.id)) {
        return interaction.reply({ content: MESSAGES.ERROR.NOT_A_TICKET, ephemeral: true });
    }
    if (!isStaff(interaction.member)) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
    }

    const member  = interaction.options.getUser('utente');
    const role    = interaction.options.getRole('ruolo');
    const targets = [member, role].filter(Boolean);

    if (targets.length === 0) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_TARGET, ephemeral: true });
    }

    try {
        for (const target of targets) {
            await channel.permissionOverwrites.edit(target, { ViewChannel: true, SendMessages: true });
        }
        const mentions = targets.map(t => t.toString()).join(', ');
        const msg = store.ticketMessages.add;
        if (msg) {
            await interaction.reply({ embeds: [buildTicketMsgEmbed(msg, { '{member}': mentions, '{role}': mentions })], ephemeral: false });
        } else {
            await interaction.reply({ content: MESSAGES.SUCCESS.ADDED_TO_TICKET.replace('{targets}', mentions), ephemeral: false });
        }
    } catch (err) {
        await interaction.reply({ content: MESSAGES.ERROR.GENERIC.replace('{error}', err.message), ephemeral: true });
    }
}

async function handleRemove(interaction) {
    const { channel } = interaction;
    if (!store.getTicket(channel.id)) {
        return interaction.reply({ content: MESSAGES.ERROR.NOT_A_TICKET, ephemeral: true });
    }
    if (!isStaff(interaction.member)) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
    }

    const member  = interaction.options.getUser('member');
    const role    = interaction.options.getRole('ruolo');
    const targets = [member, role].filter(Boolean);

    if (targets.length === 0) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_TARGET, ephemeral: true });
    }

    const ticketInfo = store.getTicket(channel.id);
    const ownerId    = store.extractOwnerId(ticketInfo);
    const staffId    = store.config.ticket_staff_role_id;

    if (member) {
        if (member.id === ownerId) {
            return interaction.reply({ content: MESSAGES.ERROR.CANNOT_REMOVE_OWNER, ephemeral: true });
        }
        if (staffId && interaction.guild.members.cache.get(member.id)?.roles.cache.has(staffId)) {
            return interaction.reply({ content: MESSAGES.ERROR.CANNOT_REMOVE_STAFF, ephemeral: true });
        }
    }

    try {
        for (const target of targets) {
            await channel.permissionOverwrites.delete(target);
        }
        const mentions = targets.map(t => t.toString()).join(', ');
        const msg = store.ticketMessages.remove;
        if (msg) {
            await interaction.reply({ embeds: [buildTicketMsgEmbed(msg, { '{member}': mentions })], ephemeral: false });
        } else {
            await interaction.reply({ content: MESSAGES.SUCCESS.REMOVED_FROM_TICKET.replace('{member}', mentions), ephemeral: false });
        }
    } catch (err) {
        await interaction.reply({ content: MESSAGES.ERROR.GENERIC.replace('{error}', err.message), ephemeral: true });
    }
}

async function handleList(interaction) {
    if (!isStaff(interaction.member)) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
    }

    const { client } = interaction;
    const user          = interaction.options.getUser('user');
    const openEntries   = store.getOpenTicketsByUser(user.id);
    const closedEntries = store.getClosedTicketsByUser(user.id);

    const openTickets = openEntries
        .map(([channelId]) => client.channels.cache.get(channelId)?.toString())
        .filter(Boolean);

    const closedTickets = closedEntries.map(([num, info]) =>
        `***\`#${num}\`*** - ${info.channel_name || 'Unknown'}`
    );

    await interaction.reply({ embeds: [buildListEmbed(user, openTickets, closedTickets)], ephemeral: true });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 60_000);
}

async function handleTranscript(interaction) {
    const number     = interaction.options.getInteger('number');
    const ticketInfo = store.getClosedTicket(number);
    if (!ticketInfo) {
        return interaction.reply({ content: MESSAGES.ERROR.TICKET_NOT_FOUND, ephemeral: true });
    }

    const ownerId = store.extractOwnerId(ticketInfo);
    if (ownerId !== interaction.user.id && !isStaff(interaction.member)) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
    }

    const filename = store.resolveTranscriptFile(number, ticketInfo);
    if (!filename) {
        return interaction.reply({ content: MESSAGES.ERROR.TRANSCRIPT_NOT_FOUND, ephemeral: true });
    }

    if (interaction.deferred || interaction.replied) return;
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    await interaction.followUp({
        files:    [{ attachment: filename, name: `transcript-${number}.txt` }],
        ephemeral: true,
    });
}

async function handleSendTranscript(interaction) {
    const number = interaction.options.getInteger('number');
    const user   = interaction.options.getUser('user');

    if (!isStaff(interaction.member) && !hasAdminOrOwner(interaction)) {
        return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
    }

    const ticketInfo = store.getClosedTicket(number);
    const filename   = store.resolveTranscriptFile(number, ticketInfo);
    if (!filename) {
        return interaction.reply({ content: MESSAGES.ERROR.TRANSCRIPT_NOT_FOUND, ephemeral: true });
    }

    if (interaction.deferred || interaction.replied) return;
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
        await user.send({
            content: `Transcript del ticket #${number}`,
            files:   [{ attachment: filename, name: `transcript-${number}.txt` }],
        });
        await interaction.followUp({
            content:  MESSAGES.SUCCESS.TRANSCRIPT_SENT.replace('{number}', number).replace('{user}', user.toString()),
            ephemeral: true,
        });
    } catch (err) {
        const content = err.code === 50007
            ? MESSAGES.ERROR.DM_CLOSED
            : MESSAGES.ERROR.SEND_TRANSCRIPT_FAILED;
        if (err.code !== 50007) logger.error(`[${MODULE_NAME}] Error sending transcript: ${err.message}`);
        await interaction.followUp({ content, ephemeral: true });
    }
}

module.exports = {
    handleTicketPanel,
    handleClose,
    handleRename,
    handleBlacklist,
    handleAdd,
    handleRemove,
    handleList,
    handleTranscript,
    handleSendTranscript,
};
