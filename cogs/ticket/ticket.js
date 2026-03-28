const { ownerOrHasPermissions } = require('../../utils/botUtils');
const { PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

const { MODULE_NAME, COMMAND_NAMES, MESSAGES } = require('./constants');
const { getCommands } = require('./src/commands');
const store = require('./src/services/ticketStore');
const { buildPanelEmbed, buildButtonRows } = require('./src/services/embedBuilder');

const {
    handleTicketPanel,
    handleClose,
    handleRename,
    handleBlacklist,
    handleAdd,
    handleRemove,
    handleList,
    handleTranscript,
    handleSendTranscript,
} = require('./src/handlers/commandHandlers');

const {
    handleTicketButton,
    handleCloseButton,
    handleConfirmClose,
    handleCancelClose,
} = require('./src/handlers/buttonHandlers');

const { handleTicketModal } = require('./src/handlers/modalHandlers');
const { handleMemberLeave } = require('./src/handlers/memberHandlers');

// ── Cog ────────────────────────────────────────────────────────────────────

class TicketCog {
    constructor(client) {
        this.client   = client;
        this.commands = getCommands();
        logger.info(`[${MODULE_NAME}] Ticket system initialized.`);
    }

    // Exposed for interactionCreate.js (reads ticket_buttons to detect panel clicks)
    get config() { return store.config; }

    // Called by reloadService.js
    reloadTicket() { store.reloadMessages(); }

    // Called by ready.js on startup
    async restoreTicketPanel() {
        const { ticket_panel_channel_id: channelId, ticket_panel_message_id: messageId } = store.config;
        if (!channelId || !messageId) return;

        let channel;
        try {
            channel = await this.client.channels.fetch(channelId);
            if (!channel?.isTextBased()) return;
            await channel.messages.fetch(messageId);
            logger.info(`[${MODULE_NAME}] Ticket panel already present, no restore needed.`);
            return;
        } catch {
            logger.warn(`[${MODULE_NAME}] Ticket panel missing, recreating...`);
        }

        if (!channel) return;

        const message = await channel.send({
            embeds:     [buildPanelEmbed(store.config)],
            components: buildButtonRows(store.config.ticket_buttons || []),
        });

        store.config.ticket_panel_message_id = message.id;
        store.saveConfig();
        logger.info(`[${MODULE_NAME}] Ticket panel restored successfully.`);
    }

    // Called externally by reload command handlers
    async handleReloadTicket(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            return interaction.reply({ content: MESSAGES.ERROR.NO_PERMISSION, ephemeral: true });
        }
        try {
            this.reloadTicket();
            await interaction.reply({ content: MESSAGES.SUCCESS.CONFIG_RELOADED, ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: `❌ Errore nel ricaricare: ${err.message}`, ephemeral: true });
        }
    }
}

// ── Setup ──────────────────────────────────────────────────────────────────

function setup(client) {
    logger.info(`[${MODULE_NAME}] Initializing Ticket System...`);

    const cog = new TicketCog(client);

    client.on('interactionCreate', async (interaction) => {
        try {
            if (interaction.isButton()) {
                const ticketButtons = store.config.ticket_buttons || [];
                if (ticketButtons.some(btn => btn.id === interaction.customId))
                    return handleTicketButton(interaction);
                if (interaction.customId === 'ticket_close')   return handleCloseButton(interaction);
                if (interaction.customId === 'confirm_close')  return handleConfirmClose(interaction);
                if (interaction.customId === 'cancel_close')   return handleCancelClose(interaction);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal:')) {
                return handleTicketModal(interaction);
            }

            if (!interaction.isChatInputCommand()) return;
            if (!COMMAND_NAMES.includes(interaction.commandName)) return;

            switch (interaction.commandName) {
                case 'ticketpanel':    return handleTicketPanel(interaction);
                case 'close':          return handleClose(interaction);
                case 'rename':         return handleRename(interaction);
                case 'blacklist':      return handleBlacklist(interaction);
                case 'add':            return handleAdd(interaction);
                case 'remove':         return handleRemove(interaction);
                case 'list':           return handleList(interaction);
                case 'transcript':     return handleTranscript(interaction);
                case 'sendtranscript': return handleSendTranscript(interaction);
            }
        } catch (err) {
            logger.error(`[${MODULE_NAME}] Unhandled error in interactionCreate:`, err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Si è verificato un errore inaspettato.', ephemeral: true }).catch(() => {});
            }
        }
    });

    client.on('guildMemberRemove', (member) => handleMemberLeave(member).catch(err =>
        logger.error(`[${MODULE_NAME}] guildMemberRemove error: ${err.message}`)
    ));

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.commands);

    logger.info(`[${MODULE_NAME}] Ticket System initialized successfully.`);
    return cog;
}

module.exports = { setup, TicketCog };
