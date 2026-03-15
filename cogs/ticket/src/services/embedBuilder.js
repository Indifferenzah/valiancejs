const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

/**
 * Replaces all template keys in a string with their values.
 * Keys are escaped so they're treated as literals, not regex patterns.
 * @param {string} str
 * @param {Record<string, string>} vars  e.g. { '{mention}': '<@123>' }
 * @returns {string}
 */
function applyTemplate(str, vars) {
    if (!str) return str;
    return Object.entries(vars).reduce((acc, [key, value]) => {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return acc.replace(new RegExp(escaped, 'g'), value ?? '');
    }, str);
}

// ── Panel ──────────────────────────────────────────────────────────────────

function buildPanelEmbed(config) {
    const panel = config.ticket_panel || {};
    const embed = new EmbedBuilder()
        .setTitle(panel.title || 'Support Tickets')
        .setDescription(panel.description || 'Click a button to open a ticket')
        .setColor(panel.color || 0x00ff00);
    if (panel.thumbnail) embed.setThumbnail(panel.thumbnail);
    if (panel.footer)    embed.setFooter({ text: panel.footer });
    return embed;
}

function buildButtonRows(buttons) {
    const rows = [];
    let row   = new ActionRowBuilder();
    let count = 0;

    for (const btn of buttons) {
        if (count >= 5) {
            rows.push(row);
            row   = new ActionRowBuilder();
            count = 0;
        }
        const button = new ButtonBuilder()
            .setCustomId(btn.id)
            .setLabel(btn.label)
            .setStyle(_resolveStyle(btn.style));
        if (btn.emoji) button.setEmoji(btn.emoji);
        row.addComponents(button);
        count++;
    }
    if (count > 0) rows.push(row);
    return rows;
}

// ── Inside ticket ──────────────────────────────────────────────────────────

function buildTicketEmbed(message) {
    return new EmbedBuilder().setDescription(message).setColor(0x00ff00);
}

function buildCloseButtonRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Chiudi Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );
}

// ── Close confirmation ─────────────────────────────────────────────────────

function buildConfirmCloseEmbed() {
    return new EmbedBuilder()
        .setTitle('Conferma Chiusura')
        .setDescription('Sei sicuro di voler chiudere questo ticket? Verrà generato e inviato il transcript.')
        .setColor(0xff0000);
}

function buildConfirmCloseRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('confirm_close')
            .setLabel('Conferma')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId('cancel_close')
            .setLabel('Annulla')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
    );
}

// ── /list ──────────────────────────────────────────────────────────────────

function buildListEmbed(user, openTickets, closedTickets) {
    return new EmbedBuilder()
        .setTitle(`Ticket di ${user.username}`)
        .setColor(0x00ff00)
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setFooter({ text: 'Valiance | Ticket System' })
        .addFields(
            {
                name:   '**Ticket Aperti**',
                value:  openTickets.length   > 0 ? openTickets.join('\n')   : 'Nessuno',
                inline: false,
            },
            {
                name:   '**Ticket Chiusi**',
                value:  closedTickets.length > 0 ? closedTickets.join('\n') : 'Nessuno',
                inline: false,
            }
        );
}

// ── Transcript ─────────────────────────────────────────────────────────────

function buildTranscriptEmbed(embedData, vars) {
    const embed = new EmbedBuilder()
        .setTitle(applyTemplate(embedData.title || 'Transcript del Ticket', vars))
        .setDescription(applyTemplate(embedData.description || 'Ecco il transcript del ticket.', vars))
        .setColor(embedData.color || 0x00ff00);
    if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
    if (embedData.footer)    embed.setFooter({ text: applyTemplate(embedData.footer, vars) });
    return embed;
}

// ── ticketmsg.json embeds (rename / add / remove) ──────────────────────────

function buildTicketMsgEmbed(msg, replaceVars = {}) {
    let description = msg.description || '';
    for (const [key, value] of Object.entries(replaceVars)) {
        description = description.replace(key, value);
    }
    const embed = new EmbedBuilder()
        .setTitle(msg.title)
        .setDescription(description)
        .setColor(msg.color);
    if (msg.thumbnail) embed.setThumbnail(msg.thumbnail);
    if (msg.footer)    embed.setFooter({ text: msg.footer });
    return embed;
}

// ── Internal ───────────────────────────────────────────────────────────────

function _resolveStyle(styleStr) {
    switch (styleStr?.toLowerCase()) {
        case 'primary':   return ButtonStyle.Primary;
        case 'secondary': return ButtonStyle.Secondary;
        case 'success':   return ButtonStyle.Success;
        case 'danger':    return ButtonStyle.Danger;
        default:          return ButtonStyle.Primary;
    }
}

module.exports = {
    applyTemplate,
    buildPanelEmbed,
    buildButtonRows,
    buildTicketEmbed,
    buildCloseButtonRow,
    buildConfirmCloseEmbed,
    buildConfirmCloseRow,
    buildListEmbed,
    buildTranscriptEmbed,
    buildTicketMsgEmbed,
};
