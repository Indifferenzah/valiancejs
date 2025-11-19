const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { isOwner, ownerOrHasPermissions } = require('../../utils/botUtils');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');

const BASE_DIR = __dirname;
const CONFIG_PATH = path.join(__dirname, '../../../config.json');
const TICKETMSG_JSON = path.join(BASE_DIR, 'ticketmsg.json');
const TICKET_JSON = path.join(BASE_DIR, 'ticket.json');
const CLOSED_TICKETS_JSON = path.join(BASE_DIR, 'closed_tickets.json');
const BLACKLIST_JSON = path.join(BASE_DIR, 'blacklist.json');

class TicketCog {
    constructor(client) {
        this.client = client;
        this.config = loadJsonSync(CONFIG_PATH);
        this.ticketMessages = loadJsonSync(TICKETMSG_JSON, {});
        this.ticketOwners = loadJsonSync(TICKET_JSON, {});
        this.closedTickets = loadJsonSync(CLOSED_TICKETS_JSON, {});
        this.blacklist = loadJsonSync(BLACKLIST_JSON, []);
    }

    saveTickets() {
        saveJsonSync(TICKET_JSON, this.ticketOwners);
    }

    reloadTicket() {
        this.ticketMessages = loadJsonSync(TICKETMSG_JSON, {});
    }

    async setupPersistentViews() {
        try {
            const buttons = this.config.ticket_buttons || [];
            this.client.ticketView = new TicketView(buttons, this.config, this);
            this.client.closeTicketView = new CloseTicketView(null, this);
            
            // Re-attach views to existing tickets
            for (const [channelId, ticketInfo] of Object.entries(this.ticketOwners)) {
                if (ticketInfo.close_message_id) {
                    const channel = this.client.channels.cache.get(channelId);
                    if (channel) {
                        try {
                            const message = await channel.messages.fetch(ticketInfo.close_message_id);
                            const view = new CloseTicketView(channelId, this);
                            await message.edit({ components: [view.getActionRow()] });
                            logger.info(`View re-attached for ticket ${channel.name}`);
                        } catch (error) {
                            logger.error(`Error re-attaching view for ticket ${channelId}: ${error.message}`);
                        }
                    } else {
                        delete this.ticketOwners[channelId];
                        this.saveTickets();
                        logger.info(`Ticket ${channelId} removed (channel deleted)`);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error setting up persistent views: ${error.message}`);
        }
    }

    formatMessageForTranscript(message, staffRoleId = null) {
        let prefix = '';
        try {
            if (message.author.id === this.client.user.id) {
                prefix = '[BOT] ';
            } else {
                const cwRoleId = '1350073967716732971';
                const authorRoles = message.member?.roles?.cache || new Map();
                
                if (staffRoleId && authorRoles.has(staffRoleId)) {
                    prefix = '[STAFF] ';
                } else if (authorRoles.has(cwRoleId)) {
                    prefix = '[STAFF CW] ';
                }
            }
        } catch (error) {
            // Ignore errors
        }

        const parts = [];
        if (message.content && message.content.trim()) {
            parts.push(message.content);
        }

        for (const embed of message.embeds) {
            const embParts = [];
            if (embed.title) embParts.push(embed.title);
            if (embed.description) embParts.push(embed.description);
            for (const field of embed.fields) {
                embParts.push(`${field.name}: ${field.value}`);
            }
            if (embParts.length > 0) {
                parts.push('[EMBED] ' + embParts.join(' | '));
            }
        }

        if (message.attachments.size > 0) {
            const attachments = Array.from(message.attachments.values()).map(a => a.name);
            parts.push('[ATTACHMENTS] ' + attachments.join(', '));
        }

        const content = parts.join(' ') || '';
        const timeStr = message.createdAt.toISOString().replace('T', ' ').split('.')[0];
        const author = message.author.username || message.author.id;
        
        return `[${timeStr}] ${prefix}${author}: ${content}`;
    }

    getCommands() {
        return [
            new SlashCommandBuilder()
                .setName('ticketpanel')
                .setDescription('Crea un pannello per i ticket di supporto'),
            
            new SlashCommandBuilder()
                .setName('close')
                .setDescription('Avvia la procedura di chiusura del ticket'),
            
            new SlashCommandBuilder()
                .setName('rename')
                .setDescription('Rinomina il canale ticket')
                .addStringOption(option =>
                    option.setName('new_name')
                        .setDescription('Il nuovo nome del canale (max 100 caratteri)')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('blacklist')
                .setDescription('Aggiungi/rimuovi un utente dalla blacklist dei ticket')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Utente da blacklistare / de-blacklistare')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('add')
                .setDescription('Aggiungi un utente al ticket')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Utente da aggiungere')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('remove')
                .setDescription('Rimuovi un utente dal ticket')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Utente da rimuovere')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('list')
                .setDescription('Mostra i ticket aperti e chiusi di un utente')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente di cui mostrare i ticket')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('transcript')
                .setDescription('Invia il transcript di un ticket chiuso')
                .addIntegerOption(option =>
                    option.setName('number')
                        .setDescription('Numero del ticket')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('sendtranscript')
                .setDescription('Manda via DM il transcript di un ticket chiuso a un utente')
                .addIntegerOption(option =>
                    option.setName('number')
                        .setDescription('Numero del ticket')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente a cui inviare il transcript')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('reloadticket')
                .setDescription('Ricarica la configurazione ticketmsg.json senza riavviare il bot (solo admin)')
        ];
    }

    async handleCommand(interaction) {
        const { commandName } = interaction;

        switch (commandName) {
            case 'ticketpanel':
                await this.handleTicketPanel(interaction);
                break;
            case 'close':
                await this.handleClose(interaction);
                break;
            case 'rename':
                await this.handleRename(interaction);
                break;
            case 'blacklist':
                await this.handleBlacklist(interaction);
                break;
            case 'add':
                await this.handleAdd(interaction);
                break;
            case 'remove':
                await this.handleRemove(interaction);
                break;
            case 'list':
                await this.handleList(interaction);
                break;
            case 'transcript':
                await this.handleTranscript(interaction);
                break;
            case 'sendtranscript':
                await this.handleSendTranscript(interaction);
                break;
            case 'reloadticket':
                await this.handleReloadTicket(interaction);
                break;
        }
    }

    async handleTicketPanel(interaction) {
        if (!isOwner(interaction.user)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        const panel = this.config.ticket_panel || {};
        const embed = new EmbedBuilder()
            .setTitle(panel.title || 'Support Tickets')
            .setDescription(panel.description || 'Click a button to open a ticket')
            .setColor(panel.color || 0x00ff00);

        if (panel.thumbnail) {
            embed.setThumbnail(panel.thumbnail);
        }
        if (panel.footer) {
            embed.setFooter({ text: panel.footer });
        }

        const allButtons = this.config.ticket_buttons || [];
        const userRoleIds = interaction.member.roles.cache.map(role => role.id);
        const filteredButtons = allButtons.filter(btn => {
            const roles = btn.roles || [];
            return roles.length === 0 || roles.some(roleId => userRoleIds.includes(roleId));
        });

        const view = new TicketView(filteredButtons, this.config, this);
        const message = await interaction.channel.send({ embeds: [embed], components: view.getActionRows() });

        this.config.ticket_panel_channel_id = interaction.channel.id;
        this.config.ticket_panel_message_id = message.id;
        saveJsonSync(CONFIG_PATH, this.config);

        await interaction.reply({ content: '✅ Pannello ticket creato!', ephemeral: true });
    }

    async handleClose(interaction) {
        const channel = interaction.channel;
        if (!this.ticketOwners[channel.id]) {
            await interaction.reply({ content: '❌ Questo comando può essere usato solo nei canali ticket!', ephemeral: true });
            return;
        }

        const staffRoleId = this.config.ticket_staff_role_id;
        if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
            await interaction.reply({ content: '❌ Non hai i permessi per chiudere i ticket!', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Conferma Chiusura')
            .setDescription('Sei sicuro di voler chiudere questo ticket? Verrà generato e inviato il transcript.')
            .setColor(0xff0000);

        const view = new ConfirmCloseView(channel.id, this);
        await interaction.reply({ embeds: [embed], components: [view.getActionRow()], ephemeral: true });
    }

    // Altri metodi handle... (continua con la stessa logica del Python)
}

class TicketView {
    constructor(buttons, config, cog) {
        this.buttons = buttons;
        this.config = config;
        this.cog = cog;
    }

    getActionRows() {
        const rows = [];
        let currentRow = new ActionRowBuilder();
        let buttonsInRow = 0;

        for (const btn of this.buttons) {
            if (buttonsInRow >= 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
                buttonsInRow = 0;
            }

            const style = this.getButtonStyle(btn.style);
            const button = new ButtonBuilder()
                .setCustomId(btn.id)
                .setLabel(btn.label)
                .setStyle(style);

            if (btn.emoji) {
                button.setEmoji(btn.emoji);
            }

            currentRow.addComponents(button);
            buttonsInRow++;
        }

        if (buttonsInRow > 0) {
            rows.push(currentRow);
        }

        return rows;
    }

    getButtonStyle(styleStr) {
        switch (styleStr?.toLowerCase()) {
            case 'primary': return ButtonStyle.Primary;
            case 'secondary': return ButtonStyle.Secondary;
            case 'success': return ButtonStyle.Success;
            case 'danger': return ButtonStyle.Danger;
            default: return ButtonStyle.Primary;
        }
    }
}

class CloseTicketView {
    constructor(channelId, cog) {
        this.channelId = channelId;
        this.cog = cog;
    }

    getActionRow() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_close')
                    .setLabel('Chiudi Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );
    }
}

class ConfirmCloseView {
    constructor(channelId, cog) {
        this.channelId = channelId;
        this.cog = cog;
    }

    getActionRow() {
        return new ActionRowBuilder()
            .addComponents(
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
}

function setup(client) {
    const cog = new TicketCog(client);
    
    // Register commands
    const commands = cog.getCommands();
    for (const command of commands) {
        client.application?.commands.create(command);
    }

    // Handle interactions
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isCommand()) {
            const commandNames = ['ticketpanel', 'close', 'rename', 'blacklist', 'add', 'remove', 'list', 'transcript', 'sendtranscript', 'reloadticket'];
            if (commandNames.includes(interaction.commandName)) {
                await cog.handleCommand(interaction);
            }
        } else if (interaction.isButton()) {
            // Handle button interactions for tickets
            if (interaction.customId.startsWith('ticket_') || cog.config.ticket_buttons?.some(btn => btn.id === interaction.customId)) {
                await handleTicketButton(interaction, cog);
            }
        }
    });

    return cog;
}

async function handleTicketButton(interaction, cog) {
    // Implementa la logica per gestire i pulsanti dei ticket
    // Simile alla callback del TicketButton in Python
}

module.exports = { setup, TicketCog };