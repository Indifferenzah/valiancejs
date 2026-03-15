const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ChannelType,
    PermissionFlagsBits,
} = require('discord.js');

const logger = require('../../../../utils/logger');
const { MODULE_NAME, MESSAGES } = require('../../constants');
const store = require('../services/ticketStore');
const transcript = require('../services/transcriptService');
const {
    applyTemplate,
    buildTicketEmbed,
    buildCloseButtonRow,
    buildConfirmCloseEmbed,
    buildConfirmCloseRow,
    buildTranscriptEmbed,
} = require('../services/embedBuilder');

// ── Helpers ────────────────────────────────────────────────────────────────

function isStaff(member) {
    const staffRoleId = store.config.ticket_staff_role_id;
    return Boolean(staffRoleId && member.roles.cache.has(staffRoleId));
}

function extractQuestions(buttonConfig) {
    let questions = Array.isArray(buttonConfig.questions) ? buttonConfig.questions : [];
    if (questions.length === 0 && Array.isArray(buttonConfig.form?.questions)) {
        questions = buttonConfig.form.questions;
    }
    return questions
        .filter(q => q && (q.id || q.label || q.placeholder))
        .slice(0, 5);
}

function checkMaxTickets(interaction) {
    const max = parseInt(store.config.ticket_max_per_user || 0);
    if (max <= 0) return true;
    const count = store.getOpenTicketsByUser(interaction.user.id).length;
    if (count >= max) {
        interaction.reply({
            content:  MESSAGES.INFO.MAX_TICKETS.replace('{count}', count).replace('{max}', max),
            ephemeral: true,
        }).catch(() => {});
        return false;
    }
    return true;
}

async function safeReply(interaction, options) {
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(options).catch(() =>
                interaction.editReply(options).catch(() => {})
            );
        } else {
            await interaction.reply(options);
        }
    } catch { /* interaction expired */ }
}

// ── Ticket open (shared between button and modal) ──────────────────────────

async function openTicketChannel(interaction, buttonConfig, answerVars) {
    if (!checkMaxTickets(interaction)) return;

    const { guild, client } = interaction;
    const { ticket_category_id, ticket_staff_role_id } = store.config;
    const category = ticket_category_id ? guild.channels.cache.get(ticket_category_id) : null;

    const overwrites = [
        { id: guild.roles.everyone.id, deny:  [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ];
    if (ticket_staff_role_id) {
        overwrites.push({ id: ticket_staff_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    }
    for (const roleId of (buttonConfig.roles || [])) {
        overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    }

    const ticketNumber = (store.config.ticket_counter || 0) + 1;
    store.config.ticket_counter = ticketNumber;
    store.saveConfig();

    const templateVars = { '{mention}': interaction.user.toString(), ...answerVars };

    try {
        const channel = await guild.channels.create({
            name:                 `ticket-${ticketNumber}`,
            type:                 ChannelType.GuildText,
            parent:               category,
            permissionOverwrites: overwrites,
        });

        store.setTicket(channel.id, {
            owner:   interaction.user.id,
            button:  buttonConfig.id,
            number:  ticketNumber,
            answers: answerVars,
        });

        await channel.send(applyTemplate(buttonConfig.outside_message || 'Ticket aperto!', templateVars));

        const embedMsg = await channel.send({
            embeds:     [buildTicketEmbed(applyTemplate(
                buttonConfig.embed_message || 'A breve riceverai il supporto richiesto.\nClicca il bottone sotto per chiudere il ticket.',
                templateVars
            ))],
            components: [buildCloseButtonRow()],
        });

        store.updateTicketField(channel.id, 'close_message_id', embedMsg.id);

        if (client.logCog) {
            client.logCog.logTicketOpen(interaction.user, channel.toString(), String(ticketNumber), buttonConfig.label || 'Generale')
                .catch(err => logger.error(`[${MODULE_NAME}] logTicketOpen failed: ${err?.message}`));
        }

        await safeReply(interaction, {
            content:  MESSAGES.SUCCESS.TICKET_CREATED.replace('{channel}', channel.toString()),
            ephemeral: true,
        });
    } catch (err) {
        logger.error(`[${MODULE_NAME}] Error creating ticket: ${err.message}`);
        await safeReply(interaction, { content: MESSAGES.ERROR.CREATE_FAILED, ephemeral: true });
    }
}

// ── Exported handlers ──────────────────────────────────────────────────────

async function handleTicketButton(interaction) {
    if (store.isBlacklisted(interaction.user.id)) {
        return interaction.reply({ content: MESSAGES.ERROR.BLACKLISTED, ephemeral: true });
    }

    const buttonConfig = (store.config.ticket_buttons || []).find(b => b.id === interaction.customId);
    if (!buttonConfig) {
        return interaction.reply({ content: MESSAGES.ERROR.BUTTON_NOT_FOUND, ephemeral: true });
    }

    const questions = extractQuestions(buttonConfig);
    if (questions.length === 0) {
        return openTicketChannel(interaction, buttonConfig, {});
    }

    if (!checkMaxTickets(interaction)) return;

    const modal = new ModalBuilder()
        .setCustomId(`ticket_modal:${buttonConfig.id}`)
        .setTitle(buttonConfig.form?.title || buttonConfig.label || 'Ticket');

    modal.addComponents(...questions.map((q, i) => {
        const input = new TextInputBuilder()
            .setCustomId(q.id || `q${i + 1}`)
            .setLabel(q.label || `Domanda ${i + 1}`)
            .setStyle(q.type === 'short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
            .setRequired(q.required ?? false);
        if (q.placeholder) input.setPlaceholder(q.placeholder);
        return new ActionRowBuilder().addComponents(input);
    }));

    await interaction.showModal(modal);
}

async function handleCloseButton(interaction) {
    if (!store.getTicket(interaction.channel.id)) {
        return interaction.reply({ content: MESSAGES.ERROR.NOT_A_VALID_TICKET, ephemeral: true });
    }
    if (!isStaff(interaction.member)) {
        return interaction.reply({ content: MESSAGES.ERROR.ONLY_STAFF_CLOSE, ephemeral: true });
    }
    await interaction.reply({
        embeds:     [buildConfirmCloseEmbed()],
        components: [buildConfirmCloseRow()],
        ephemeral:  true,
    });
}

async function handleConfirmClose(interaction) {
    const { channel, client } = interaction;
    const ticketInfo = store.getTicket(channel.id);
    if (!ticketInfo) {
        return interaction.reply({ content: MESSAGES.ERROR.TICKET_NOT_FOUND, ephemeral: true });
    }
    if (interaction.deferred || interaction.replied) return;
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
        const staffRoleId  = store.config.ticket_staff_role_id;
        const messages     = await transcript.fetchAllMessages(channel);
        const transcriptText = messages.map(m => transcript.formatMessage(m, staffRoleId)).join('\n');

        const ticketNumber = ticketInfo.number || 1;
        const ownerId      = store.extractOwnerId(ticketInfo);
        const filename     = transcript.saveTranscript(ticketNumber, transcriptText);
        const openerUser   = ownerId ? await client.users.fetch(ownerId).catch(() => null) : null;

        const ticketVars = {
            '{opener}':  openerUser?.toString() || 'Unknown',
            '{staffer}': interaction.user?.toString() || 'Unknown',
            '{name}':    channel.name,
            '{id}':      ticketInfo.button || '',
            '{channel}': channel.toString(),
            '{number}':  String(ticketNumber),
            '{mention}': openerUser?.toString() || 'Unknown',
            ...Object.fromEntries(
                Object.entries(ticketInfo.answers || {}).map(([k, v]) => [k, v?.trim() || 'N/A'])
            ),
        };

        const payload = {
            embeds: [buildTranscriptEmbed(store.config.ticket_transcript_embed || {}, ticketVars)],
            files:  [{ attachment: filename, name: `transcript-${ticketNumber}.txt` }],
        };

        const transcriptChannelId = store.config.ticket_transcript_channel_id;
        if (transcriptChannelId) {
            await transcript.sendToLogChannel(client, transcriptChannelId, payload);
        }
        if (openerUser) {
            await transcript.sendToUser(openerUser, {
                ...payload,
                content: applyTemplate('Transcript del ticket #{number}', ticketVars),
            });
        }

        store.saveClosedTicket(ticketNumber, {
            owner:           ownerId,
            transcript_file: filename,
            closed_at:       new Date().toISOString(),
            button:          ticketInfo.button || '',
            channel_name:    channel.name,
            answers:         ticketInfo.answers || {},
        });

        if (client.logCog) {
            const openerTag = openerUser ? (openerUser.tag || openerUser.username || 'Unknown') : 'Unknown';
            const staffTag  = interaction.user ? (interaction.user.tag || interaction.user.username || 'Unknown') : 'Unknown';
            client.logCog.logTicketClose(channel.name, openerTag, staffTag, String(ticketNumber))
                .catch(err => logger.error(`[${MODULE_NAME}] logTicketClose failed: ${err?.message}`));
        }

        await channel.delete();
        store.deleteTicket(channel.id);
    } catch (err) {
        logger.error(`[${MODULE_NAME}] Error closing ticket: ${err.message}`);
        await interaction.followUp({ content: MESSAGES.ERROR.CLOSE_FAILED, ephemeral: true });
    }
}

async function handleCancelClose(interaction) {
    await interaction.reply({ content: MESSAGES.INFO.CLOSE_CANCELLED, ephemeral: true });
}

module.exports = {
    handleTicketButton,
    handleCloseButton,
    handleConfirmClose,
    handleCancelClose,
    openTicketChannel,
    extractQuestions,
};
