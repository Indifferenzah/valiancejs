const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
process.env.FFMPEG_PATH = ffmpegInstaller.path;

const { Client, GatewayIntentBits, Collection, EmbedBuilder, PermissionFlagsBits, ChannelType, ActivityType, Status, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const { OWNER_ID, ownerOrHasPermissions, isOwner } = require('./utils/botUtils');

let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ]
});

client.setMaxListeners(20);

client.commands = new Collection();
client.cogs = new Collection();

const activeSessions = new Map();
let waitingForRuleset = false;
let waitingForWelcome = false;
let waitingForBoost = false;
const recentWelcomes = new Set();
const recentBoosts = new Set();

class GameSession {
    constructor(guild, lobbyChannel) {
        this.guild = guild;
        this.lobbyChannel = lobbyChannel;
        this.textChannel = null;
        this.redVoice = null;
        this.greenVoice = null;
        this.taggedUsers = [];
        this.isActive = false;
    }
}

const cogsToLoad = [
    'ticket/ticket',
    'moderation/moderation', 
    'autorole/autorole',
    'log/log',
    'fun/fun',
    'regole/regole',
    'tts/tts',
    'cw/cw',
    'giveaway/giveaway',
    'help',
    'levels/levels',
    'util/reminders',
    'social/marriage',
    'rep/reputation',
    'birthdays/birthdays',
    'counters/counters',
    'stats/stats',
    'aimod/aimod',
    'coralmc/coralmc',
    'traduttore/traduttore'
];

for (const cogPath of cogsToLoad) {
    try {
        const cogFile = path.join(__dirname, 'cogs', `${cogPath}.js`);
        if (fs.existsSync(cogFile)) {
            const cog = require(cogFile);
            if (cog.setup) {
                const cogInstance = cog.setup(client);
                const cogName = cogPath.split('/').pop();
                client.cogs.set(cogName, cogInstance);
                logger.info(`Loaded cog: ${cogName}`);
            }
        } else {
            logger.warn(`Cog file not found: ${cogFile}`);
        }
    } catch (error) {
        logger.error(`Failed to load cog ${cogPath}: ${error.message}`);
    }
}

const aimodCog = client.cogs.get('aimod');
const moderationCog = client.cogs.get('moderation');

if (aimodCog && moderationCog) {
    aimodCog.bindModerationCog(moderationCog);
    logger.info('[AI-MOD] Bind con moderation effettuato');
} else {
    logger.warn('[AI-MOD] Bind saltato: aimod o moderation mancanti');
}

function updateStatus() {
    const status = config.bot_status || 'dnd';
    const activityType = config.bot_activity_type || 'watching';
    const activityName = config.bot_activity_name || '{membri} membri';
    
    let statusEnum;
    switch (status) {
        case 'online': statusEnum = Status.Online; break;
        case 'idle': statusEnum = Status.Idle; break;
        case 'dnd': statusEnum = Status.DoNotDisturb; break;
        case 'invisible': statusEnum = Status.Invisible; break;
        default: statusEnum = Status.DoNotDisturb;
    }

    let membri;
    if (config.bot_activity_guild_id) {
        const specificGuild = client.guilds.cache.get(config.bot_activity_guild_id);
        membri = specificGuild ? specificGuild.memberCount : client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    } else {
        membri = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    }

    const finalActivityName = activityName.replace('{membri}', membri.toString());

    let activity;
    switch (activityType) {
        case 'playing':
            activity = { name: finalActivityName, type: ActivityType.Playing };
            break;
        case 'streaming':
            activity = { name: finalActivityName, type: ActivityType.Streaming, url: config.bot_activity_url || '' };
            break;
        case 'listening':
            activity = { name: finalActivityName, type: ActivityType.Listening };
            break;
        case 'watching':
            activity = { name: finalActivityName, type: ActivityType.Watching };
            break;
        case 'competing':
            activity = { name: finalActivityName, type: ActivityType.Competing };
            break;
        default:
            activity = { name: finalActivityName, type: ActivityType.Watching };
    }

    client.user.setPresence({ status: statusEnum, activities: [activity] });
}

const commands = [
    new SlashCommandBuilder()
        .setName('cwend')
        .setDescription('Termina la partita custom e elimina i canali (solo admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('setruleset')
        .setDescription('Imposta il ruleset (solo per admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('ruleset')
        .setDescription('Mostra il ruleset salvato'),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Elimina un numero di messaggi (1-250)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Numero di messaggi da eliminare (1-250)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(250)),
    
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Mostra la latenza del bot'),
    
    new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Mostra da quanto tempo il bot è online'),
    
    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Crea e modifica un embed in tempo reale (solo admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Comandi di verifica')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Invia il pannello di verifica con pulsante (solo admin)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('forceverify')
                .setDescription('Verifica forzatamente un membro (solo admin)')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Membro da verificare forzatamente')
                        .setRequired(true))),
    

];

const contextMenus = [
    new ContextMenuCommandBuilder()
        .setName('Force Verify')
        .setType(ApplicationCommandType.User)
];

client.once('clientReady', async () => {
    client.startTime = new Date();
    logger.info(`Bot connected as ${client.user.tag}`);
    
    try {
        const allCommands = [
            ...commands,
            ...contextMenus,
        ];

        if (client.globalCommands) {
            allCommands.push(...client.globalCommands);
        }
        
        await client.application.commands.set(allCommands);
        logger.info(`Synced ${allCommands.length} slash commands`);
    } catch (error) {
        logger.error(`Error syncing commands: ${error.message}`);
    }

    setInterval(updateStatus, 5 * 60 * 1000);
    updateStatus();

    try {
        const VerifyView = require('./views/VerifyView');
        client.verifyView = new VerifyView(config);
        logger.info('VerifyView registered as persistent view');
    } catch (error) {
        logger.error(`Error registering VerifyView: ${error.message}`);
    }

    const counterCog = client.cogs.get('counters');
    if (counterCog && counterCog.onReady) {
        await counterCog.onReady();
    }

    const ticketCog = client.cogs.get('ticket');
    if (ticketCog?.restoreTicketPanel) {
        await ticketCog.restoreTicketPanel();
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isUserContextMenuCommand()) {
        if (interaction.commandName === 'Force Verify') {
            return handleForceVerifyContext(interaction);
        }
    }

    const ticketCog = client.cogs.get('ticket');
    if (ticketCog) {

        if (interaction.isButton()) {
            const id = interaction.customId;

            if (
                id === 'ticket_close' ||
                id === 'confirm_close' ||
                id === 'cancel_close' ||
                config.ticket_buttons?.some(btn => btn.id === id)
            ) {
                try {
                    if (id === 'ticket_close') return ticketCog.handleCloseButton(interaction);
                    if (id === 'confirm_close') return ticketCog.handleConfirmClose(interaction);
                    if (id === 'cancel_close') return ticketCog.handleCancelClose(interaction);

                    return ticketCog.handleTicketButton(interaction);
                } catch (err) {
                    logger.error(`Ticket button error: ${err.message}`);
                }
            }
        }

        if (interaction.isModalSubmit()) {

            if (interaction.customId.startsWith('ticket_modal:')) {
                return ticketCog.handleTicketModal(interaction);
            }

            if (interaction.customId.startsWith('moderation_')) {
                const modCog = client.cogs.get('moderation');
                if (modCog?.handleModerationModal) {
                    return modCog.handleModerationModal(interaction);
                }
            }

            return;
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
            if (client.verifyView) {
                try {
                    await client.verifyView.handleVerifyClick(interaction);
                } catch (error) {
                    logger.error(`Error in verify button: ${error.message}`);
                }
            }
        }
        return;
    }
    
    if (interaction.isStringSelectMenu()) {
        try {
            if (interaction.customId === 'help_select') {
                const helpViews = client.helpViews || new Map();
                const view = helpViews.get(interaction.user.id);
                if (view) {
                    await view.handleSelectCallback(interaction);
                }
            }
        } catch (error) {
            logger.error(`Error in select menu: ${error.message}`);
        }
        return;
    }
    
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'cwend':
                await handleCwEnd(interaction);
                break;
            case 'setruleset':
                await handleSetRuleset(interaction);
                break;
            case 'ruleset':
                await handleRuleset(interaction);
                break;
            case 'purge':
                await handlePurge(interaction);
                break;
            case 'ping':
                await handlePing(interaction);
                break;
            case 'uptime':
                await handleUptime(interaction);
                break;
            case 'embed':
                await handleEmbed(interaction);
                break;
            case 'verify':
                await handleVerify(interaction);
                break;

            case 'help':
                if (client.helpCog) {
                    await client.helpCog.handleHelp(interaction);
                }
                break;
        }
    } catch (error) {
        logger.error(`Error handling command ${commandName}: ${error.message}`);
        
        const errorMessage = '❌ Si è verificato un errore durante l\'esecuzione del comando.';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followup.send({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

async function handleForceVerifyContext(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        return interaction.reply({
            content: '❌ Non hai abbastanza permessi.',
            ephemeral: true
        });
    }

    const member = interaction.targetMember;
    if (!member) {
        return interaction.reply({
            content: '❌ Utente non valido.',
            ephemeral: true
        });
    }

    const addRoleId = config.verify_add_role_id;
    const removeRoleId = config.verify_remove_role_id;

    if (!addRoleId && !removeRoleId) {
        return interaction.reply({
            content: '⚠️ Ruoli di verifica non configurati.',
            ephemeral: true
        });
    }

    let added = false;
    let removed = false;

    if (addRoleId) {
        const role = interaction.guild.roles.cache.get(addRoleId);
        if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role, `Force verify by ${interaction.user.tag}`);
            added = true;
        }
    }

    if (removeRoleId) {
        const role = interaction.guild.roles.cache.get(removeRoleId);
        if (role && member.roles.cache.has(role.id)) {
            await member.roles.remove(role, `Force verify by ${interaction.user.tag}`);
            removed = true;
        }
    }

    let msg = `✅ Verifica forzata completata per ${member}.`;
    if (added && removed) msg = `✅ ${member} verificato forzatamente.`;
    else if (added || removed) msg = `⚠️ Azione parziale completata su ${member}.`;

    await interaction.reply({ content: msg, ephemeral: true });
    logger.info(`ForceVerify (context) by ${interaction.user.tag} on ${member.user.tag}`);
}

async function handleCwEnd(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const guildId = interaction.guild.id;
    
    if (!activeSessions.has(guildId)) {
        await interaction.reply({ content: '❌ Non ci sono partite attive!', ephemeral: true });
        return;
    }

    await interaction.reply({ content: '🧹 Terminazione partita in corso...', ephemeral: true });
    await cleanupSession(guildId);
    await interaction.followup.send({ content: '✅ Partita terminata e canali eliminati!', ephemeral: true });
    logger.info(`Game ended by ${interaction.user.tag} in ${interaction.guild.name}`);
}

async function handleSetRuleset(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    waitingForRuleset = true;
    await interaction.reply({ content: '📝 Invia il prossimo messaggio che vuoi salvare come ruleset.', ephemeral: false });
    logger.info(`/setruleset used by ${interaction.user.tag} in ${interaction.guild.name}`);
}

async function handleRuleset(interaction) {
    if (!config.ruleset_message) {
        await interaction.reply({ content: '❌ Nessun ruleset configurato! Usa `/setruleset` per impostarne uno.', ephemeral: false });
        return;
    }

    await interaction.reply({ content: config.ruleset_message, ephemeral: false });
    logger.info(`Ruleset shown to ${interaction.user.tag} in ${interaction.guild.name}`);
}

async function handlePurge(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.ManageMessages)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const limit = interaction.options.getInteger('limit');

    if (limit < 1 || limit > 250) {
        await interaction.reply({ content: '❌ Puoi scegliere numeri tra 1 e 250.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const messages = await interaction.channel.messages.fetch({ limit, before: interaction.id });
        await interaction.channel.bulkDelete(messages);

        await interaction.followUp({
            content: `✅ Ho eliminato ${messages.size} messaggi.`,
            ephemeral: true
        });

        logger.info(`Purge executed: ${messages.size} messages deleted by ${interaction.user.tag} in ${interaction.channel.name}`);
    } catch (error) {
        await interaction.followUp({
            content: `❌ Errore durante la purge: ${error.message}`,
            ephemeral: true
        });

        logger.error(`Purge error by ${interaction.user.tag}: ${error.message}`);
    }
}

async function handlePing(interaction) {
    const latency = Math.round(interaction.client.ws.ping);

    await interaction.reply({
        content: `🏓 Pong! Latenza: ${latency}ms`,
        ephemeral: true
    });

    logger.info(`/ping used by ${interaction.user.tag} - Latency: ${latency}ms`);
}

async function handleUptime(interaction) {
    const uptime = client.startTime ? Date.now() - client.startTime.getTime() : 0;
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
    
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    await interaction.reply({ content: `**⏱️ Uptime**: ${uptimeStr}`, ephemeral: true });
    logger.info(`/uptime used by ${interaction.user.tag} - Uptime: ${uptimeStr}`);
}


class EmbedCreatorSession {
    constructor(authorId, interaction) {
        this.authorId = authorId;
        this.interaction = interaction;
        this.embed = new EmbedBuilder()
            .setTitle('Embed Creator')
            .setDescription("Usa il menu per personalizzare l'embed. Usa `//` per rimuovere un campo.")
            .setColor(0x00ff00)
            .setFooter({ text: 'Valiance Bot - Embed Creator' });
        this.fields = [];
        this.messageContent = '';
        this.targetChannel = null;
    }

    buildEmbed() {
        const clone = EmbedBuilder.from(this.embed);
        clone.data.fields = [];
        for (const f of this.fields) {
            clone.addFields(f);
        }
        return clone;
    }

    components() {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('embed_creator_select')
            .setPlaceholder('Seleziona cosa modificare')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Titolo').setValue('title').setDescription('Modifica il titolo'),
                new StringSelectMenuOptionBuilder().setLabel('Descrizione').setValue('description').setDescription('Modifica la descrizione'),
                new StringSelectMenuOptionBuilder().setLabel('Colore').setValue('color').setDescription('Modifica il colore'),
                new StringSelectMenuOptionBuilder().setLabel('Thumbnail').setValue('thumbnail').setDescription('Modifica il thumbnail'),
                new StringSelectMenuOptionBuilder().setLabel('Immagine').setValue('image').setDescription("Modifica l'immagine principale"),
                new StringSelectMenuOptionBuilder().setLabel('Footer').setValue('footer').setDescription('Modifica il footer'),
                new StringSelectMenuOptionBuilder().setLabel('Aggiungi Campo').setValue('add_field').setDescription('Aggiungi un campo'),
                new StringSelectMenuOptionBuilder().setLabel('Messaggio Fuori Embed').setValue('content').setDescription("Testo insieme all'embed"),
                new StringSelectMenuOptionBuilder().setLabel('Scegli Canale').setValue('choose_channel').setDescription('Canale dove inviare'),
                new StringSelectMenuOptionBuilder().setLabel('Invia Embed').setValue('send').setDescription("Invia l'embed"),
                new StringSelectMenuOptionBuilder().setLabel('Annulla').setValue('cancel').setDescription('Annulla creazione')
            );
        return [new ActionRowBuilder().addComponents(menu)];
    }

    async showFieldModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('embed_field_modal')
            .setTitle('Aggiungi Campo')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('field_name')
                        .setLabel('Nome del campo')
                        .setRequired(true)
                        .setMaxLength(256)
                        .setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('field_value')
                        .setLabel('Valore del campo')
                        .setRequired(true)
                        .setMaxLength(1024)
                        .setStyle(TextInputStyle.Paragraph)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('field_inline')
                        .setLabel('Inline? (true/false, opzionale)')
                        .setRequired(false)
                        .setMaxLength(5)
                        .setStyle(TextInputStyle.Short)
                )
            );
        await interaction.showModal(modal);
        const submitted = await interaction.awaitModalSubmit({
            filter: (m) => m.customId === 'embed_field_modal' && m.user.id === this.authorId,
            time: 300000
        }).catch(() => null);
        if (!submitted) return;
        const name = submitted.fields.getTextInputValue('field_name').trim();
        const value = submitted.fields.getTextInputValue('field_value').trim();
        const inlineRaw = submitted.fields.getTextInputValue('field_inline').trim().toLowerCase();
        const inline = inlineRaw === 'true';
        if (name === '//' || value === '//') {
            await submitted.update({ components: this.components(), embeds: [this.buildEmbed()] });
            return;
        }
        if (this.fields.length >= 25) {
            await submitted.reply({ content: '? Puoi aggiungere massimo 25 campi!', ephemeral: true });
            return;
        }
        this.fields.push({ name, value, inline });
        await submitted.update({ embeds: [this.buildEmbed()], components: this.components() });
    }

    async showChannelModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('embed_channel_modal')
            .setTitle('Scegli Canale')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('channel_id')
                        .setLabel('ID del canale')
                        .setRequired(true)
                        .setMaxLength(25)
                        .setStyle(TextInputStyle.Short)
                )
            );
        await interaction.showModal(modal);
        const submitted = await interaction.awaitModalSubmit({
            filter: (m) => m.customId === 'embed_channel_modal' && m.user.id === this.authorId,
            time: 300000
        }).catch(() => null);
        if (!submitted) return;
        const channelId = submitted.fields.getTextInputValue('channel_id').trim();
        const channel = submitted.guild.channels.cache.get(channelId);
        if (!channel) {
            await submitted.reply({ content: '? Canale non trovato!', ephemeral: true });
            return;
        }
        this.targetChannel = channel;
        await submitted.reply({ content: `? Canale impostato a ${channel}.`, ephemeral: true });
    }

    async showEditModal(interaction, field) {
        const modalId = `embed_edit_${field}`;
        const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(`Modifica ${field}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('value')
                        .setLabel(`Nuovo ${field}`)
                        .setRequired(true)
                        .setMaxLength(4000)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Usa // per cancellare')
                )
            );
        await interaction.showModal(modal);
        const submitted = await interaction.awaitModalSubmit({
            filter: (m) => m.customId === modalId && m.user.id === this.authorId,
            time: 300000
        }).catch(() => null);
        if (!submitted) return;
        const value = submitted.fields.getTextInputValue('value').trim();
        try {
            if (value === '//') {
                switch (field) {
                    case 'color':
                        this.embed.setColor(null);
                        break;
                    case 'thumbnail':
                        this.embed.setThumbnail(null);
                        break;
                    case 'image':
                        this.embed.setImage(null);
                        break;
                    case 'footer':
                        this.embed.setFooter(null);
                        break;
                    case 'content':
                        this.messageContent = '';
                        break;
                    case 'title':
                        this.embed.setTitle('');
                        break;
                    case 'description':
                        this.embed.setDescription('');
                        break;
                    default:
                        break;
                }
            } else {
                switch (field) {
                    case 'color': {
                        let parsed = value;
                        if (value.startsWith('#')) parsed = parseInt(value.slice(1), 16);
                        else parsed = parseInt(value, 10);
                        if (Number.isNaN(parsed)) throw new Error('Colore non valido');
                        this.embed.setColor(parsed);
                        break;
                    }
                    case 'thumbnail':
                        this.embed.setThumbnail(value);
                        break;
                    case 'image':
                        this.embed.setImage(value);
                        break;
                    case 'footer':
                        this.embed.setFooter({ text: value, iconURL: this.embed.data.footer?.icon_url });
                        break;
                    case 'content':
                        this.messageContent = value;
                        break;
                    case 'title':
                        this.embed.setTitle(value);
                        break;
                    case 'description':
                        this.embed.setDescription(value);
                        break;
                    default:
                        break;
                }
            }
            await submitted.update({ embeds: [this.buildEmbed()], components: this.components() });
        } catch (error) {
            await submitted.reply({ content: `? Errore nella modifica: ${error.message}`, ephemeral: true });
        }
    }

    async sendEmbed(interaction) {
        try {
            const targetChannel = this.targetChannel || interaction.channel;
            await targetChannel.send({ content: this.messageContent || null, embeds: [this.buildEmbed()] });
            await interaction.update({ content: '✅ Embed inviato con successo!', embeds: [], components: [] });
            logger.info(`Embed inviato da ${interaction.user.tag} in ${interaction.guild.name}`);
        } catch (error) {
            await interaction.reply({ content: `❌ Errore nell'invio dell'embed: ${error.message}`, ephemeral: true });
        }
    }
}

async function handleEmbed(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '??O Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const session = new EmbedCreatorSession(interaction.user.id, interaction);
    const reply = await interaction.reply({
        embeds: [session.buildEmbed()],
        components: session.components(),
        ephemeral: true,
        fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
        time: 300000,
        filter: (i) => i.user.id === interaction.user.id && i.customId === 'embed_creator_select'
    });

    collector.on('collect', async (i) => {
        const choice = i.values[0];
        switch (choice) {
            case 'send':
                await session.sendEmbed(i);
                collector.stop('sent');
                break;
            case 'cancel':
                await i.update({ content: '❌ Creazione embed annullata.', embeds: [], components: [] });
                collector.stop('cancel');
                break;
            case 'add_field':
                await session.showFieldModal(i);
                break;
            case 'choose_channel':
                await session.showChannelModal(i);
                break;
            default:
                await session.showEditModal(i, choice);
                break;
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            await interaction.editReply({ content: '⏱️ Tempo scaduto.', components: [], embeds: [] }).catch(() => { });
        }
    });

    logger.info(`/embed used by ${interaction.user.tag} in ${interaction.guild.name}`);
}

async function handleVerify(interaction) {
    const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'panel') {
            if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
                await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
                return;
            }

            try {
                const vmsg = config.verify_message || {};
                const title = vmsg.title || 'Verifica l\'accesso';
                const description = vmsg.description || 'Clicca il pulsante qui sotto per verificarti.';
                const color = vmsg.color || 0x2ecc71;

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(color);

                if (vmsg.thumbnail) embed.setThumbnail(vmsg.thumbnail);
                if (vmsg.footer) embed.setFooter({ text: vmsg.footer });
                if (vmsg.image) embed.setImage(vmsg.image);

                const VerifyView = require('./views/VerifyView');
                const view = new VerifyView(config);

                await interaction.reply({ embeds: [embed], components: view.components });
                logger.info(`/verify panel used by ${interaction.user.tag} in ${interaction.guild.name}`);
            } catch (error) {
                await interaction.reply({ content: `❌ Errore1: ${error.message}`, ephemeral: true });
                logger.error(`Error in /verify panel: ${error.message}`);
            }
        } else if (subcommand === 'forceverify') {
            if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
                await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
                return;
            }

            const member = interaction.options.getMember('member');
        
            try {
                const addRoleId = config.verify_add_role_id;
                const removeRoleId = config.verify_remove_role_id;

                let added = false, removed = false;

                if (addRoleId) {
                    const role = interaction.guild.roles.cache.get(addRoleId);
                    if (role && !member.roles.cache.has(role.id)) {
                        await member.roles.add(role, `Force verify by ${interaction.user.tag}`);
                        added = true;
                    }
                }

                if (removeRoleId) {
                    const role = interaction.guild.roles.cache.get(removeRoleId);
                    if (role && member.roles.cache.has(role.id)) {
                        await member.roles.remove(role, `Force verify by ${interaction.user.tag}`);
                        removed = true;
                    }
                }

                if (!addRoleId && !removeRoleId) {
                    await interaction.reply({ content: '⚠️ Ruoli di verifica non configurati.', ephemeral: true });
                    return;
                }

                let msg = `✅ Verifica forzata completata per ${member.toString()}.`;
                if (added && removed) {
                    msg = `✅ ${member.toString()} verificato forzatamente.`;
                } else if (added) {
                    msg = `⚠️ Ruolo aggiunto a ${member.toString()}, ma verifica incompleta.`;
                } else if (removed) {
                    msg = `⚠️ Ruolo rimosso da ${member.toString()}, ma verifica incompleta.`;
                }

                await interaction.reply({ content: msg, ephemeral: true });
                logger.info(`/verify forceverify used by ${interaction.user.tag} on ${member.user.tag}`);
            } catch (error) {
                await interaction.reply({ content: `❌ Errore2: ${error.message}`, ephemeral: true });
                logger.error(`Error in /verify forceverify: ${error.message}`);
            }
        }
    }



    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (newState.member.user.bot) return;

        const lobbyId = config.lobby_voice_channel_id;
    
        if (newState.channel && newState.channel.id === lobbyId) {
            await checkAndCreateGame(newState.channel);
            return;
        }

        try {
            let leftChannel = null;
            if (oldState.channel && (!newState.channel || oldState.channel.id !== newState.channel.id)) {
                leftChannel = oldState.channel;
            }

            if (leftChannel) {
                for (const [guildId, session] of activeSessions) {
                    if ((session.redVoice && session.redVoice.id === leftChannel.id) ||
                        (session.greenVoice && session.greenVoice.id === leftChannel.id)) {
                    
                        const redEmpty = !session.redVoice || session.redVoice.members.filter(m => !m.user.bot).size === 0;
                        const greenEmpty = !session.greenVoice || session.greenVoice.members.filter(m => !m.user.bot).size === 0;

                        if (redEmpty && greenEmpty) {
                            await cleanupSession(guildId);
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            logger.error(`Error in voice state cleanup: ${error.message}`);
        }
    });

    client.on('guildMemberAdd', async (member) => {
        if (recentWelcomes.has(member.id)) return;
        recentWelcomes.add(member.id);
        setTimeout(() => recentWelcomes.delete(member.id), 10000);
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
    });

    client.on('guildMemberUpdate', async (oldMember, newMember) => {

        const firstBoost = !oldMember.premiumSince && newMember.premiumSince;

        const boostUpgrade = oldMember.premiumTier !== newMember.premiumTier;

        if (!firstBoost && !boostUpgrade) return;

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
    });


    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const mentionPattern = new RegExp(`^<@!?${client.user.id}>$`);
        if (mentionPattern.test(message.content.trim())) {
            await message.channel.send('❌ Sistema trasferito su comandi /. Usa `/help` per vedere una lista di comandi disponibili.');
            return;
        }

        if (waitingForRuleset && message.author.id === OWNER_ID) {
            config.ruleset_message = message.content;
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
            waitingForRuleset = false;
            await message.react('✅');
            await message.channel.send('✅ Ruleset salvato! Usa `/ruleset` per visualizzarlo.');
            return;
        }

        if (waitingForWelcome && message.author.id === OWNER_ID) {
            config.welcome_message.description = message.content;
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
            waitingForWelcome = false;
            await message.react('✅');
            await message.channel.send('✅ Messaggio di benvenuto salvato!\n\n**Variabili disponibili:**\n`{mention}` - Tag dell\'utente\n`{username}` - Nome utente\n`{avatar}` - Avatar utente (per thumbnail)');
            return;
        }

        const content = message.content.trim();
        const prefixes = config.prefixes || ['v!'];
    
        for (const prefix of prefixes) {
            if (content.startsWith(prefix)) {
                if (content.startsWith(prefix + '!') || content.startsWith(prefix + '?')) {
                    return;
                }
                await message.channel.send('❌ Sistema trasferito su comandi /. Usa `/help` per vedere una lista di comandi disponibili.');
                return;
            }
        }

        if (['wlc', 'welcome', 'benvenuto'].includes(message.content.toLowerCase())) {
            const emojis = config.welcome_emojis || [];
            for (const emoji of emojis) {
                try {
                    await message.react(emoji);
                } catch (error) {
                    logger.error(`Error adding reaction ${emoji}: ${error.message}`);
                }
            }
        }

        const guild = message.guild;
        if (!guild || !activeSessions.has(guild.id)) return;

        const session = activeSessions.get(guild.id);
        if (!session.isActive || message.channel !== session.textChannel) return;

        for (const mention of message.mentions.users.values()) {
            const member = guild.members.cache.get(mention.id);
            if (!member || session.taggedUsers.includes(member)) continue;

            session.taggedUsers.push(member);
            const position = session.taggedUsers.length - 1;
            const isRed = position < 4;

            if (member.voice && member.voice.channel) {
                try {
                    const targetChannel = isRed ? session.redVoice : session.greenVoice;
                    await member.voice.setChannel(targetChannel);
                    const teamName = isRed ? 'ROSSO' : 'VERDE';
                    logger.info(`Moved ${member.user.username} to team ${teamName}`);
                
                    await session.textChannel.send(`${member.toString()} → ${isRed ? 'Team Rosso' : 'Team Verde'}`);
                } catch (error) {
                    logger.error(`Error moving ${member.user.username}: ${error.message}`);
                }
            }
        }
    });

    async function checkAndCreateGame(lobbyChannel) {
        const guild = lobbyChannel.guild;
    
        if (activeSessions.has(guild.id) && activeSessions.get(guild.id).isActive) {
            return;
        }

        const members = lobbyChannel.members.filter(m => !m.user.bot);
    
        if (members.size >= 1) {
            logger.info('Player detected! Creating game...');
            await createGameSession(guild, lobbyChannel);
        }
    }

    async function createGameSession(guild, lobbyChannel) {
        try {
            const session = new GameSession(guild, lobbyChannel);
            session.isActive = true;

            const category = config.category_id ? guild.channels.cache.get(config.category_id) : null;
            const adminUser = guild.members.cache.get(OWNER_ID);

            const overwrites = [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect]
                }
            ];

            if (adminUser) {
                overwrites.push({
                    id: adminUser.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.ManageRoles,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak,
                        PermissionFlagsBits.MoveMembers
                    ]
                });
            }

            const cwAllowedRoles = [
                '1426247366037602474',
                '1350073964235325562',
                '1350073966009782363'
            ];

            const textChannelOverwrites = [
                ...overwrites,
                ...cwAllowedRoles.map(roleId => ({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.SendMessages
                    ]
                }))
            ];
            
            session.textChannel = await guild.channels.create({
                name: 'cw-interna',
                type: ChannelType.GuildText,
                parent: category,
                topic: 'CW - Team Rosso vs Verde',
                permissionOverwrites: textChannelOverwrites
            });

            session.redVoice = await guild.channels.create({
                name: 'Team Rosso',
                type: ChannelType.GuildVoice,
                parent: category,
                userLimit: 4,
                permissionOverwrites: overwrites
            });

            session.greenVoice = await guild.channels.create({
                name: 'Team Verde',
                type: ChannelType.GuildVoice,
                parent: category,
                userLimit: 4,
                permissionOverwrites: overwrites
            });

            const embed = new EmbedBuilder()
                .setTitle('**CW Interna** - Istruzioni')
                .setDescription('**CW Interne Valiance**\n\nTagga fino a 8 giocatori per assegnare i team automaticamente:\n> I primi 4 taggati verranno inseriti nel team ROSSO\n> Gli altri 4 nel team VERDE')
                .setColor(0x0099FF)
                .setFooter({ text: 'Usa `!cwend` per terminare la partita ed eliminare tutti i canali.' });

            await session.textChannel.send({ embeds: [embed] });
            activeSessions.set(guild.id, session);
            logger.info(`Game created successfully in server ${guild.name}`);
        } catch (error) {
            logger.error(`Error creating game: ${error.message}`);
            await cleanupSession(guild.id);
        }
    }

    async function cleanupSession(guildId) {
        if (!activeSessions.has(guildId)) return;

        const session = activeSessions.get(guildId);

        try {
            if (session.textChannel) {
                await session.textChannel.delete();
                logger.info('Text channel deleted');
            }
            if (session.redVoice) {
                await session.redVoice.delete();
                logger.info('Red voice channel deleted');
            }
            if (session.greenVoice) {
                await session.greenVoice.delete();
                logger.info('Green voice channel deleted');
            }

            activeSessions.delete(guildId);
            logger.info('Session cleaned up successfully');
        } catch (error) {
            logger.error(`Error during cleanup: ${error.message}`);
        }
    }

    function reloadGlobalConfig() {
        config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    
        const moderationCog = client.cogs.get('moderation');
        if (moderationCog && moderationCog.reloadConfig) {
            moderationCog.reloadConfig();
        }

        const logCog = client.cogs.get('log');
        if (logCog && logCog.reloadConfig) {
            logCog.reloadConfig();
        }
    }

    function reloadAll() {
        config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

        const moderationCog = client.cogs.get('moderation');
        if (moderationCog && moderationCog.reloadMod) {
            moderationCog.reloadMod();
        }

        const ticketCog = client.cogs.get('ticket');
        if (ticketCog && ticketCog.reloadTicket) {
            ticketCog.reloadTicket();
        }

        const logCog = client.cogs.get('log');
        if (logCog && logCog.reloadConfig) {
            logCog.reloadConfig();
        }
    }

    module.exports = {
        client,
        config,
        activeSessions,
        waitingForRuleset,
        waitingForWelcome,
        waitingForBoost,
        cleanupSession,
        GameSession,
        reloadGlobalConfig,
        reloadAll
    };

    client.login(process.env.TOKEN);
