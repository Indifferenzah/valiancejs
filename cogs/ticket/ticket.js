const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { isOwner, ownerOrHasPermissions } = require('../../utils/botUtils');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');

const BASE_DIR = __dirname;
const CONFIG_PATH = path.join(__dirname, '../../config.json');
const TICKETMSG_JSON = path.join(BASE_DIR, 'ticketmsg.json');
const TICKET_JSON = path.join(BASE_DIR, 'ticket.json');
const CLOSED_TICKETS_JSON = path.join(BASE_DIR, 'closed_tickets.json');
const BLACKLIST_JSON = path.join(BASE_DIR, 'blacklist.json');

class TicketCog {
    constructor(client) {
        this.client = client;
        this.config = loadJsonSync(CONFIG_PATH);
        this.ticketMessages = loadJsonSync(TICKETMSG_JSON, {});
        this.ticketOwners = this.loadTicketOwners();
        this.closedTickets = loadJsonSync(CLOSED_TICKETS_JSON, {});
        this.blacklist = loadJsonSync(BLACKLIST_JSON, []);
    }

    saveTickets() {
        const preparedTickets = this.prepareTicketsForSave();
        const jsonString = JSON.stringify(preparedTickets, null, 2)
            .replace(/"owner": "(\d+)"/g, '"owner": $1')
            .replace(/"close_message_id": "(\d+)"/g, '"close_message_id": $1');
        fs.mkdirSync(path.dirname(TICKET_JSON), { recursive: true });
        fs.writeFileSync(TICKET_JSON, jsonString, 'utf8');
    }

    loadTicketOwners() {
        try {
            const raw = fs.readFileSync(TICKET_JSON, 'utf8');
            const sanitized = raw
                .replace(/\uFEFF/g, '')
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/("owner": )(\d+)/g, '$1"$2"')
                .replace(/("close_message_id": )(\d+)/g, '$1"$2"');

            try {
                const parsed = JSON.parse(sanitized);
                return this.normalizeTicketOwners(parsed);
            } catch (parseError) {
                const backupPath = `${TICKET_JSON}.bak`;
                fs.writeFileSync(backupPath, raw, 'utf8');
                logger.error(`Could not parse ${TICKET_JSON}: ${parseError.message}. Backup saved to ${backupPath}`);
                return {};
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    }

    normalizeTicketOwners(data = {}) {
        const normalized = {};
        for (const [channelId, info] of Object.entries(data)) {
            if (info && typeof info === 'object') {
                normalized[channelId] = { ...info };
                if (info.owner !== undefined) {
                    normalized[channelId].owner = String(info.owner);
                }
                if (info.close_message_id !== undefined) {
                    normalized[channelId].close_message_id = String(info.close_message_id);
                }
            } else if (info !== undefined) {
                normalized[channelId] = String(info);
            }
        }
        return normalized;
    }

    prepareTicketsForSave() {
        const prepared = {};
        for (const [channelId, info] of Object.entries(this.ticketOwners)) {
            if (info && typeof info === 'object') {
                const copy = { ...info };
                if ('owner' in copy) {
                    const ownerId = this.getOwnerId(copy);
                    if (ownerId !== null) {
                        copy.owner = ownerId;
                    } else {
                        delete copy.owner;
                    }
                }
                if ('close_message_id' in copy) {
                    if (copy.close_message_id !== undefined && copy.close_message_id !== null) {
                        copy.close_message_id = String(copy.close_message_id);
                    } else {
                        delete copy.close_message_id;
                    }
                }
                prepared[channelId] = copy;
            } else {
                prepared[channelId] = String(info);
            }
        }
        return prepared;
    }

    getOwnerId(ticketInfo) {
        if (!ticketInfo) return null;
        const raw = (typeof ticketInfo === 'object' && ticketInfo !== null && 'owner' in ticketInfo)
            ? ticketInfo.owner
            : ticketInfo;
        return raw !== undefined && raw !== null ? String(raw) : null;
    }

    reloadTicket() {
        this.ticketMessages = loadJsonSync(TICKETMSG_JSON, {});
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
                .setDescription('Crea un pannello per i ticket di supporto')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

            new SlashCommandBuilder()
                .setName('close')
                .setDescription('Avvia la procedura di chiusura del ticket'),

            new SlashCommandBuilder()
                .setName('rename')
                .setDescription('Rinomina il canale ticket')
                .addStringOption(option =>
                    option.setName('nome')
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
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addIntegerOption(option =>
                    option.setName('number')
                        .setDescription('Numero del ticket')
                        .setRequired(true)),

            new SlashCommandBuilder()
                .setName('sendtranscript')
                .setDescription('Manda via DM il transcript di un ticket chiuso a un utente')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addIntegerOption(option =>
                    option.setName('number')
                        .setDescription('Numero del ticket')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente a cui inviare il transcript')
                        .setRequired(true)),
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

        const rows = this.createButtonRows(filteredButtons);
        const message = await interaction.channel.send({ embeds: [embed], components: rows });

        this.config.ticket_panel_channel_id = interaction.channel.id;
        this.config.ticket_panel_message_id = message.id;
        saveJsonSync(CONFIG_PATH, this.config);

        await interaction.reply({ content: '✅ Pannello ticket creato!', ephemeral: true });
    }

    createButtonRows(buttons) {
        const rows = [];
        let currentRow = new ActionRowBuilder();
        let buttonsInRow = 0;

        for (const btn of buttons) {
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

    async handleTicketButton(interaction) {
        if (this.blacklist.includes(interaction.user.id)) {
            await interaction.reply({ content: '❌ Sei nella blacklist e non puoi aprire ticket!', ephemeral: true });
            return;
        }

        const guild = interaction.guild;
        const buttonConfig = (this.config.ticket_buttons || []).find(btn => btn.id === interaction.customId);

        if (!buttonConfig) {
            await interaction.reply({ content: '❌ Configurazione pulsante non trovata!', ephemeral: true });
            return;
        }

        let questions = Array.isArray(buttonConfig.questions) ? buttonConfig.questions : [];
        if ((!questions || questions.length === 0) && buttonConfig.form && Array.isArray(buttonConfig.form.questions)) {
            questions = buttonConfig.form.questions;
        }

        questions = questions
            .filter(q => q && (q.id || q.label || q.placeholder))
            .slice(0, 5);

        if (!questions || questions.length === 0) {
            await this.openTicketChannel(interaction, buttonConfig, {});
            return;
        }

        const maxPerUser = parseInt(this.config.ticket_max_per_user || 0);
        if (maxPerUser > 0) {
            const userTickets = Object.values(this.ticketOwners).filter(info => {
                const ownerId = this.getOwnerId(info);
                return ownerId === interaction.user.id;
            });

            if (userTickets.length >= maxPerUser) {
                await interaction.reply({
                    content: `⚠️ Hai già ${userTickets.length} ticket aperti (limite: ${maxPerUser}). Chiudi uno di questi prima di aprirne un altro.`,
                    ephemeral: true
                });
                return;
            }
        }

        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal:${buttonConfig.id}`)
            .setTitle(buttonConfig.form?.title || buttonConfig.label || 'Ticket');

        const rows = [];
        for (let i = 0; i < questions.length && i < 5; i++) {
            const q = questions[i] || {};
            const fieldId = q.id || `q${i + 1}`;
            const style = (q.type === "short")
                ? TextInputStyle.Short
                : TextInputStyle.Paragraph;

            const input = new TextInputBuilder()
                .setCustomId(fieldId)
                .setLabel(q.label || `Domanda ${i + 1}`)
                .setStyle(style)
                .setRequired(q.required ?? false);

            if (q.placeholder) {
                input.setPlaceholder(q.placeholder);
            }

            if (q.placeholder) {
                input.setPlaceholder(q.placeholder);
            }

            const row = new ActionRowBuilder().addComponents(input);
            rows.push(row);
        }

        modal.addComponents(...rows);

        await interaction.showModal(modal);
    }

    async restoreTicketPanel() {
        const channelId = this.config.ticket_panel_channel_id;
        const messageId = this.config.ticket_panel_message_id;

        if (!channelId || !messageId) return;

        let channel;

        try {
            channel = await this.client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) return;

            await channel.messages.fetch(messageId);
            logger.info('Ticket panel già presente, nessun ripristino necessario');
            return;

        } catch {
            logger.warn('Ticket panel mancante, lo ricreo');
        }

        if (!channel) return;

        const panel = this.config.ticket_panel || {};
        const embed = new EmbedBuilder()
            .setTitle(panel.title || 'Support Tickets')
            .setDescription(panel.description || 'Clicca un pulsante per aprire un ticket')
            .setColor(panel.color || 0x00ff00);

        if (panel.thumbnail) embed.setThumbnail(panel.thumbnail);
        if (panel.footer) embed.setFooter({ text: panel.footer });

        const buttons = this.config.ticket_buttons || [];
        const rows = this.createButtonRows(buttons);

        const message = await channel.send({ embeds: [embed], components: rows });

        this.config.ticket_panel_message_id = message.id;
        saveJsonSync(CONFIG_PATH, this.config);

        logger.info('Ticket panel ripristinato con successo');
    }

    async handleTicketModal(interaction) {
        const customId = interaction.customId;
        const parts = customId.split(':');
        const buttonId = parts[1];

        const buttonConfig = (this.config.ticket_buttons || []).find(btn => btn.id === buttonId);
        if (!buttonConfig) {
            await interaction.reply({ content: '❌ Configurazione pulsante non trovata!', ephemeral: true });
            return;
        }

        let questions = Array.isArray(buttonConfig.questions) ? buttonConfig.questions : [];
        if ((!questions || questions.length === 0) && buttonConfig.form && Array.isArray(buttonConfig.form.questions)) {
            questions = buttonConfig.form.questions;
        }

        questions = questions
            .filter(q => q && (q.id || q.label || q.placeholder))
            .slice(0, 5);

        const answerVars = {};

        for (let i = 0; i < questions.length && i < 5; i++) {
            const fieldId = questions[i].id || `q${i + 1}`;
            const key = `{q${i + 1}}`;

            let value = '';
            try {
                value = interaction.fields.getTextInputValue(fieldId) || '';
            } catch {
                value = '';
            }

            if (!value || value.trim() === '') {
                value = 'N/A';
            }

            answerVars[key] = value;
        }

        await this.openTicketChannel(interaction, buttonConfig, answerVars);
    }

    async openTicketChannel(interaction, buttonConfig, answerVars = {}) {
        const guild = interaction.guild;

        const maxPerUser = parseInt(this.config.ticket_max_per_user || 0);
        if (maxPerUser > 0) {
            const userTickets = Object.values(this.ticketOwners).filter(info => {
                const ownerId = this.getOwnerId(info);
                return ownerId === interaction.user.id;
            });

            if (userTickets.length >= maxPerUser) {
                await interaction.reply({
                    content: `⚠️ Hai già ${userTickets.length} ticket aperti (limite: ${maxPerUser}). Chiudi uno di questi prima di aprirne un altro.`,
                    ephemeral: true
                });
                return;
            }
        }

        const categoryId = this.config.ticket_category_id;
        const category = categoryId ? guild.channels.cache.get(categoryId) : null;

        const staffRoleId = this.config.ticket_staff_role_id;
        const overwrites = [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: interaction.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            }
        ];

        if (staffRoleId) {
            overwrites.push({
                id: staffRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            });
        }

        const additionalRoles = buttonConfig.roles || [];
        for (const roleId of additionalRoles) {
            overwrites.push({
                id: roleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            });
        }

        const ticketNumber = (this.config.ticket_counter || 0) + 1;
        this.config.ticket_counter = ticketNumber;
        saveJsonSync(CONFIG_PATH, this.config);

        const templateVars = {
            '{mention}': interaction.user.toString(),
            ...answerVars
        };

        const applyTemplate = (str) => {
            if (!str) return str;
            let result = str;
            for (const [k, v] of Object.entries(templateVars)) {
                if (v === undefined || v === null) continue;
                result = result.replace(new RegExp(k, 'g'), String(v));
            }
            return result;
        };

        try {
            const channel = await guild.channels.create({
                name: `ticket-${ticketNumber}`,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: overwrites
            });

            this.ticketOwners[channel.id] = {
                owner: interaction.user.id,
                button: buttonConfig.id,
                number: ticketNumber,
                answers: answerVars
            };

            const outsideMessage = applyTemplate(buttonConfig.outside_message || 'Ticket aperto!');
            await channel.send(outsideMessage);

            const embedMessage = applyTemplate(
                buttonConfig.embed_message ||
                'A breve riceverai il supporto richiesto.\nClicca il bottone sotto per chiudere il ticket.'
            );

            const embed = new EmbedBuilder()
                .setDescription(embedMessage)
                .setColor(0x00ff00);

            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Chiudi Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

            const message = await channel.send({ embeds: [embed], components: [closeButton] });
            this.ticketOwners[channel.id].close_message_id = message.id;
            this.saveTickets();

            if (this.client.logCog) {
                try {
                    await this.client.logCog.logTicketOpen(
                        interaction.user,
                        channel.toString(),
                        ticketNumber.toString(),
                        buttonConfig.label || 'Generale'
                    );
                } catch (err) {
                    logger.error(`logCog.logTicketOpen failed: ${err?.message || err}`);
                }
            }

            if (interaction.replied || interaction.deferred) {
                try {
                    await interaction.followUp({ content: `🎫 Ticket creato: ${channel}`, ephemeral: true });
                } catch (err) {
                    try {
                        await interaction.editReply({ content: `🎫 Ticket creato: ${channel}` });
                    } catch (e) {
                    }
                }
            } else {
                await interaction.reply({ content: `🎫 Ticket creato: ${channel}`, ephemeral: true });
            }
        } catch (error) {
            logger.error(`Error creating ticket: ${error.message}`);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ Errore nella creazione del ticket!', ephemeral: true }).catch(() => {});
                } else {
                    await interaction.reply({ content: '❌ Errore nella creazione del ticket!', ephemeral: true }).catch(() => {});
                }
            } catch {
            }
        }
    }

    async handleCloseButton(interaction) {
        const channel = interaction.channel;
        const ticketInfo = this.ticketOwners[channel.id];

        if (!ticketInfo) {
            await interaction.reply({ content: '❌ Questo non è un canale ticket valido!', ephemeral: true });
            return;
        }

        const staffRoleId = this.config.ticket_staff_role_id;
        const isStaff = staffRoleId && interaction.member.roles.cache.has(staffRoleId);

        if (!isStaff) {
            await interaction.reply({ content: '❌ Solo uno staffer può chiudere il ticket!', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Conferma Chiusura')
            .setDescription('Sei sicuro di voler chiudere questo ticket? Verrà generato e inviato il transcript.')
            .setColor(0xff0000);

        const confirmRow = new ActionRowBuilder()
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

        await interaction.reply({ embeds: [embed], components: [confirmRow], ephemeral: true });
    }

    async handleConfirmClose(interaction) {
        const channel = interaction.channel;
        const ticketInfo = this.ticketOwners[channel.id];

        if (!ticketInfo) {
            await interaction.reply({ content: '❌ Ticket non trovato!', ephemeral: true });
            return;
        }

        if (interaction.deferred || interaction.replied) {
            return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        try {
            const messages = [];
            const staffRoleId = this.config.ticket_staff_role_id;

            let lastId;
            while (true) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;

                const fetchedMessages = await channel.messages.fetch(options);
                if (fetchedMessages.size === 0) break;

                messages.push(...fetchedMessages.values());
                lastId = fetchedMessages.last().id;
            }

            messages.reverse();
            const transcript = messages.map(msg => this.formatMessageForTranscript(msg, staffRoleId)).join('\n');

            const ticketNumber = ticketInfo.number || 1;
            const ownerId = this.getOwnerId(ticketInfo);
            const transcriptDir = path.join(__dirname, '../../transcripts');
            if (!fs.existsSync(transcriptDir)) {
                fs.mkdirSync(transcriptDir, { recursive: true });
            }

            const filename = path.join(transcriptDir, `transcript-${ticketNumber}.txt`);
            fs.writeFileSync(filename, transcript, 'utf8');

            const embedData = this.config.ticket_transcript_embed || {};
            const openerUser = ownerId ? await this.client.users.fetch(ownerId).catch(() => null) : null;
            const opener = openerUser ? openerUser.toString() : 'Unknown';
            const staffer = interaction.user ? interaction.user.toString() : 'Unknown';
            const channelName = channel.name;
            const buttonId = ticketInfo.button || '';

            const ticketVars = {
                '{opener}': opener,
                '{staffer}': staffer,
                '{name}': channelName,
                '{id}': buttonId,
                '{channel}': channel.toString(),
                '{number}': String(ticketNumber),
                '{mention}': opener
            };

            const answers = ticketInfo.answers || {};
            for (const [k, v] of Object.entries(answers)) {
                ticketVars[k] = (v && v.trim() !== '') ? v : 'N/A';
            }

            const applyVars = (str) =>
                Object.entries(ticketVars).reduce((acc, [k, v]) => acc.replace(new RegExp(k, 'g'), v), str || '');

            const transcriptEmbed = new EmbedBuilder()
                .setTitle(applyVars(embedData.title || 'Transcript del Ticket'))
                .setDescription(applyVars(embedData.description || 'Ecco il transcript del ticket.'))
                .setColor(embedData.color || 0x00ff00);

            if (embedData.thumbnail) transcriptEmbed.setThumbnail(embedData.thumbnail);
            if (embedData.footer) transcriptEmbed.setFooter({ text: applyVars(embedData.footer) });

            const payload = {
                embeds: [transcriptEmbed],
                files: [{ attachment: filename, name: `transcript-${ticketNumber}.txt` }]
            };

            const transcriptChannelId = this.config.ticket_transcript_channel_id;
            if (transcriptChannelId) {
                const transcriptChannel = this.client.channels.cache.get(transcriptChannelId);
                if (transcriptChannel) {
                    await transcriptChannel.send(payload).catch(err =>
                        logger.error(`Error sending transcript to channel: ${err.message}`)
                    );
                } else {
                    logger.error('Canale transcript non trovato!');
                }
            }

            try {
                if (openerUser) {
                    await openerUser.send({
                        ...payload,
                        content: applyVars('Transcript del ticket #{number}')
                    });
                }
            } catch (error) {
                logger.error(`Could not send transcript to owner: ${error.message}`);
            }

            this.closedTickets[ticketNumber.toString()] = {
                owner: ownerId,
                transcript_file: filename,
                closed_at: new Date().toISOString(),
                button: ticketInfo.button || '',
                channel_name: channel.name,
                answers
            };
            saveJsonSync(CLOSED_TICKETS_JSON, this.closedTickets);

            if (this.client.logCog) {
                try {
                    const openerUserFull = ownerId ? await this.client.users.fetch(ownerId).catch(() => null) : null;
                    const staffTag = interaction.user ? (interaction.user.tag || interaction.user.username || 'Unknown') : 'Unknown';
                    await this.client.logCog.logTicketClose(
                        channel.name,
                        openerUserFull ? openerUserFull.tag : 'Unknown',
                        staffTag,
                        ticketNumber.toString()
                    );
                } catch (err) {
                    logger.error(`logCog.logTicketClose failed: ${err?.message || err}`);
                }
            }

            await channel.delete();

            delete this.ticketOwners[channel.id];
            this.saveTickets();
        } catch (error) {
            logger.error(`Error closing ticket: ${error.message}`);
            await interaction.followUp({ content: '❌ Errore nella chiusura del ticket!', ephemeral: true });
        }
    }

    async handleCancelClose(interaction) {
        await interaction.reply({ content: 'Chiusura annullata.', ephemeral: true });
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

        const confirmRow = new ActionRowBuilder()
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

        await interaction.reply({ embeds: [embed], components: [confirmRow], ephemeral: true });
    }

    async handleRename(interaction) {
        const channel = interaction.channel;
        const newName = interaction.options.getString('nome');

        if (!this.ticketOwners[channel.id]) {
            await interaction.reply({ content: '❌ Questo comando può essere usato solo nei canali ticket!', ephemeral: true });
            return;
        }

        const staffRoleId = this.config.ticket_staff_role_id;
        if (!staffRoleId || !interaction.member.roles.cache.has(staffRoleId)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        if (newName.length > 100) {
            await interaction.reply({ content: '❌ Il nome è troppo lungo! (max 100 caratteri)', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: false });

        try {
            await channel.setName(newName);

            const renameMsg = this.ticketMessages.rename;
            if (renameMsg) {
                const embed = new EmbedBuilder()
                    .setTitle(renameMsg.title)
                    .setDescription(renameMsg.description.replace('{name}', newName))
                    .setColor(renameMsg.color);

                if (renameMsg.thumbnail) embed.setThumbnail(renameMsg.thumbnail);
                if (renameMsg.footer) embed.setFooter({ text: renameMsg.footer });

                await interaction.followUp({ embeds: [embed], ephemeral: false });
            } else {
                await interaction.followUp({ content: '✅ Canale rinominato!', ephemeral: false });
            }
        } catch (error) {
            if (error.code === 50013) {
                await interaction.followUp({ content: '❌ Non ho i permessi per rinominare il canale!', ephemeral: true });
            } else {
                await interaction.followUp({ content: `❌ Errore nel rinominare: ${error.message}`, ephemeral: true });
            }
        }
    }

    async handleBlacklist(interaction) {
        const member = interaction.options.getUser('member');
        const staffRoleId = this.config.ticket_staff_role_id;

        if (!staffRoleId || !interaction.member.roles.cache.has(staffRoleId)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        if (this.blacklist.includes(member.id)) {
            this.blacklist = this.blacklist.filter(id => id !== member.id);
            await interaction.reply({ content: `✅ ${member} è stato rimosso dalla blacklist!`, ephemeral: true });
        } else {
            this.blacklist.push(member.id);
            await interaction.reply({ content: `✅ ${member} è stato aggiunto alla blacklist!`, ephemeral: true });
        }

        saveJsonSync(BLACKLIST_JSON, this.blacklist);
    }

    async handleAdd(interaction) {
        const member = interaction.options.getUser('member');
        const channel = interaction.channel;

        if (!this.ticketOwners[channel.id]) {
            await interaction.reply({ content: '❌ Questo comando può essere usato solo nei canali ticket!', ephemeral: true });
            return;
        }

        const staffRoleId = this.config.ticket_staff_role_id;
        if (!staffRoleId || !interaction.member.roles.cache.has(staffRoleId)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        try {
            await channel.permissionOverwrites.edit(member, {
                ViewChannel: true,
                SendMessages: true
            });

            const addMsg = this.ticketMessages.add;
            if (addMsg) {
                const embed = new EmbedBuilder()
                    .setTitle(addMsg.title)
                    .setDescription(addMsg.description.replace('{member}', member.toString()))
                    .setColor(addMsg.color);

                if (addMsg.thumbnail) embed.setThumbnail(addMsg.thumbnail);
                if (addMsg.footer) embed.setFooter({ text: addMsg.footer });

                await interaction.reply({ embeds: [embed], ephemeral: false });
            } else {
                await interaction.reply({ content: `✅ ${member} aggiunto!`, ephemeral: false });
            }
        } catch (error) {
            await interaction.reply({ content: `❌ Errore: ${error.message}`, ephemeral: true });
        }
    }

    async handleRemove(interaction) {
        const member = interaction.options.getUser('member');
        const channel = interaction.channel;

        if (!this.ticketOwners[channel.id]) {
            await interaction.reply({ content: '❌ Questo comando può essere usato solo nei canali ticket!', ephemeral: true });
            return;
        }

        const staffRoleId = this.config.ticket_staff_role_id;
        if (!staffRoleId || !interaction.member.roles.cache.has(staffRoleId)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        const ticketInfo = this.ticketOwners[channel.id];
        const ownerId = this.getOwnerId(ticketInfo);

        if (member.id === ownerId) {
            await interaction.reply({ content: '❌ Non puoi rimuovere il proprietario del ticket!', ephemeral: true });
            return;
        }

        if (staffRoleId && interaction.guild.members.cache.get(member.id)?.roles.cache.has(staffRoleId)) {
            await interaction.reply({ content: '❌ Non puoi rimuovere uno staffer!', ephemeral: true });
            return;
        }

        try {
            await channel.permissionOverwrites.delete(member);

            const removeMsg = this.ticketMessages.remove;
            if (removeMsg) {
                const embed = new EmbedBuilder()
                    .setTitle(removeMsg.title)
                    .setDescription(removeMsg.description.replace('{member}', member.toString()))
                    .setColor(removeMsg.color);

                if (removeMsg.thumbnail) embed.setThumbnail(removeMsg.thumbnail);
                if (removeMsg.footer) embed.setFooter({ text: removeMsg.footer });

                await interaction.reply({ embeds: [embed], ephemeral: false });
            } else {
                await interaction.reply({ content: `✅ ${member} rimosso!`, ephemeral: false });
            }
        } catch (error) {
            await interaction.reply({ content: `❌ Errore: ${error.message}`, ephemeral: true });
        }
    }

    async handleList(interaction) {
        const user = interaction.options.getUser('user');
        console.log(user)
        const staffRoleId = this.config.ticket_staff_role_id;

        if (!staffRoleId || !interaction.member.roles.cache.has(staffRoleId)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        const openTickets = [];
        const closedTickets = [];

        for (const [channelId, info] of Object.entries(this.ticketOwners)) {
            const ownerId = this.getOwnerId(info);
            if (ownerId === user.id) {
                const channel = this.client.channels.cache.get(channelId);
                if (channel) {
                    openTickets.push(channel.toString());
                }
            }
        }

        for (const [ticketNum, info] of Object.entries(this.closedTickets)) {
            if (String(info.owner) === user.id) {
                closedTickets.push(`***\`#${ticketNum}\`*** - ${info.channel_name || 'Unknown'}`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`Ticket di ${user.username}`)
            .setColor(0x00ff00)
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
            .setFooter({ text: 'Valiance | Ticket System' });

        embed.addFields(
            {
                name: '**Ticket Aperti**',
                value: openTickets.length > 0 ? openTickets.join('\n') : 'Nessuno',
                inline: false
            },
            {
                name: '**Ticket Chiusi**',
                value: closedTickets.length > 0 ? closedTickets.join('\n') : 'Nessuno',
                inline: false
            }
        );

        await interaction.reply({ embeds: [embed], ephemeral: true });

        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (error) {
            }
        }, 60000);
    }

    async handleTranscript(interaction) {
        const number = interaction.options.getInteger('number');
        const ticketStr = number.toString();

        if (!this.closedTickets[ticketStr]) {
            await interaction.reply({ content: '❌ Ticket non trovato!', ephemeral: true });
            return;
        }

        const ticketInfo = this.closedTickets[ticketStr];
        const ownerId = this.getOwnerId(ticketInfo);

        if (ownerId !== interaction.user.id) {
            const staffRoleId = this.config.ticket_staff_role_id;
            if (!staffRoleId || !interaction.member.roles.cache.has(staffRoleId)) {
                await interaction.reply({ content: '❌ Non hai i permessi per vedere questo transcript!', ephemeral: true });
                return;
            }
        }

        const filename = ticketInfo.transcript_file;
        if (!fs.existsSync(filename)) {
            await interaction.reply({ content: '❌ Transcript non trovato!', ephemeral: true });
            return;
        }

        if (interaction.deferred || interaction.replied) {
            return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        await interaction.followUp({
            files: [{ attachment: filename, name: `transcript-${number}.txt` }],
            ephemeral: true
        });
    }

    async handleSendTranscript(interaction) {
        const number = interaction.options.getInteger('number');
        const user = interaction.options.getUser('user');
        const staffRoleId = this.config.ticket_staff_role_id;

        const hasStaff = staffRoleId && interaction.member.roles.cache.has(staffRoleId);
        if (!hasStaff && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        const ticketStr = number.toString();
        let filename = null;

        if (this.closedTickets[ticketStr]) {
            filename = this.closedTickets[ticketStr].transcript_file;
        }

        if (!filename) {
            filename = path.join(__dirname, '../../transcripts', `transcript-${number}.txt`);
        }

        if (!fs.existsSync(filename)) {
            await interaction.reply({ content: '❌ Transcript non trovato!', ephemeral: true });
            return;
        }

        if (interaction.deferred || interaction.replied) {
            return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        try {
            await user.send({
                content: `Transcript del ticket #${number}`,
                files: [{ attachment: filename, name: `transcript-${number}.txt` }]
            });

            await interaction.followUp({
                content: `✅ Transcript del ticket #${number} inviato in DM a ${user}.`,
                ephemeral: true
            });
        } catch (error) {
            if (error.code === 50007) {
                await interaction.followUp({
                    content: '❌ Non posso inviare il DM: l\'utente ha i DM chiusi.',
                    ephemeral: true
                });
            } else {
                logger.error(`Error sending transcript: ${error.message}`);
                await interaction.followUp({
                    content: '❌ Errore durante l\'invio del transcript.',
                    ephemeral: true
                });
            }
        }
    }

    async handleReloadTicket(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        try {
            this.reloadTicket();
            await interaction.reply({ content: '✅ Configurazione ticket ricaricata con successo!', ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: `❌ Errore nel ricaricare la configurazione ticket: ${error.message}`, ephemeral: true });
        }
    }
}

function setup(client) {
    const cog = new TicketCog(client);

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            const commandNames = ['ticketpanel', 'close', 'rename', 'blacklist', 'add', 'remove', 'list', 'transcript', 'sendtranscript'];
            if (commandNames.includes(interaction.commandName)) {
                await cog.handleCommand(interaction);
            }
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.getCommands());

    return cog;
}

module.exports = { setup, TicketCog };
