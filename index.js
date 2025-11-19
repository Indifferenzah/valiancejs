const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, ActivityType, Status, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const { OWNER_ID, ownerOrHasPermissions, isOwner } = require('./utils/botUtils');

// Load config
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

client.commands = new Collection();
client.cogs = new Collection();

// Game sessions
const activeSessions = new Map();
let waitingForRuleset = false;
let waitingForWelcome = false;
let waitingForBoost = false;

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

// Load cogs
const cogsPath = path.join(__dirname, 'cogs');
const cogFolders = fs.readdirSync(cogsPath);

for (const folder of cogFolders) {
    const cogPath = path.join(cogsPath, folder);
    if (fs.statSync(cogPath).isDirectory()) {
        const cogFile = path.join(cogPath, `${folder}.js`);
        if (fs.existsSync(cogFile)) {
            try {
                const cog = require(cogFile);
                if (cog.setup) {
                    cog.setup(client);
                    client.cogs.set(folder, cog);
                    logger.info(`Loaded cog: ${folder}`);
                }
            } catch (error) {
                logger.error(`Failed to load cog ${folder}: ${error.message}`);
            }
        }
    }
}

// Status loop
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

// Core slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('cwend')
        .setDescription('Termina la partita custom e elimina i canali (solo admin)'),
    
    new SlashCommandBuilder()
        .setName('setruleset')
        .setDescription('Imposta il ruleset (solo per admin)'),
    
    new SlashCommandBuilder()
        .setName('ruleset')
        .setDescription('Mostra il ruleset salvato'),
    
    new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Elimina un canale (corrente o specificato) con conferma')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Canale da eliminare (opzionale)')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('rename_channel')
        .setDescription('Rinomina un canale (corrente o specificato) con conferma')
        .addStringOption(option =>
            option.setName('new_name')
                .setDescription('Nuovo nome del canale')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Canale da rinominare (opzionale)')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Elimina un numero di messaggi (1-250)')
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
        .setDescription('Crea e modifica un embed in tempo reale (solo admin)'),
    
    new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Comandi di verifica')
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
    
    new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Visualizza e scarica i file di log del bot'),
    
    new SlashCommandBuilder()
        .setName('dellogs')
        .setDescription('Elimina un file di log del bot'),
    
    new SlashCommandBuilder()
        .setName('reloadlog')
        .setDescription('Ricarica la configurazione log.json senza riavviare il bot (solo admin)'),
    
    new SlashCommandBuilder()
        .setName('reloadconfig')
        .setDescription('Ricarica la configurazione config.json senza riavviare il bot (solo admin)'),
    
    new SlashCommandBuilder()
        .setName('reloadall')
        .setDescription('Ricarica tutte le configurazioni senza riavviare il bot (solo admin)'),
    
    new SlashCommandBuilder()
        .setName('setlogchannel')
        .setDescription('Imposta i canali di log per ogni tipo di evento (solo admin)')
        .addStringOption(option =>
            option.setName('channel_id')
                .setDescription('ID del canale di log (se non specificato, usa questo canale per tutti)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('join_leave')
                .setDescription('Canale per join/leave')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('moderation')
                .setDescription('Canale per moderazione (ban, kick, mute, etc.)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('ticket')
                .setDescription('Canale per ticket')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('autorole')
                .setDescription('Canale per autorole')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('automod')
                .setDescription('Canale per automod')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Canale per messaggi (delete/edit)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('boost')
                .setDescription('Canale per boost server')
                .setRequired(false))
];

client.once('ready', async () => {
    client.startTime = new Date();
    logger.info(`Bot connected as ${client.user.tag}`);
    
    try {
        // Collect all commands from cogs and core commands
        const allCommands = [...commands];
        if (client.globalCommands) {
            allCommands.push(...client.globalCommands);
        }
        
        await client.application.commands.set(allCommands);
        logger.info(`Synced ${allCommands.length} slash commands`);
    } catch (error) {
        logger.error(`Error syncing commands: ${error.message}`);
    }

    setInterval(updateStatus, 5 * 60 * 1000); // Every 5 minutes
    updateStatus();

    // Register persistent views
    try {
        const VerifyView = require('./views/VerifyView');
        client.verifyView = new VerifyView(config);
        logger.info('VerifyView registered as persistent view');
    } catch (error) {
        logger.error(`Error registering VerifyView: ${error.message}`);
    }

    // Start counter update loop
    const counterCog = client.cogs.get('counters');
    if (counterCog && counterCog.startCounterLoop) {
        counterCog.startCounterLoop();
        logger.info('Counter update loop started');
    }

    // Setup ticket cog persistent views
    const ticketCog = client.cogs.get('ticket');
    if (ticketCog && ticketCog.setupPersistentViews) {
        await ticketCog.setupPersistentViews();
    }
});

client.on('interactionCreate', async (interaction) => {
    // Handle button interactions
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
            if (client.verifyView) {
                await client.verifyView.handleVerifyClick(interaction);
            }
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
            case 'delete':
                await handleDelete(interaction);
                break;
            case 'rename_channel':
                await handleRenameChannel(interaction);
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
            case 'logs':
                await handleLogs(interaction);
                break;
            case 'dellogs':
                await handleDelLogs(interaction);
                break;
            case 'reloadlog':
                await handleReloadLog(interaction);
                break;
            case 'reloadconfig':
                await handleReloadConfig(interaction);
                break;
            case 'reloadall':
                await handleReloadAll(interaction);
                break;
            case 'setlogchannel':
                await handleSetLogChannel(interaction);
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

// Command handlers
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

async function handleDelete(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    
    if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(targetChannel.type)) {
        await interaction.reply({ content: '❌ Puoi eliminare solo canali testuali o vocali.', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Conferma Eliminazione')
        .setDescription(`Sei sicuro di voler eliminare il canale **${targetChannel.name}**?\n\nQuesta azione è irreversibile.`)
        .setColor(0xff0000)
        .setFooter({ text: 'Scade in 30 secondi' });

    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_delete')
        .setLabel('Conferma')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_delete')
        .setLabel('Annulla')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    const filter = (i) => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

    collector.on('collect', async (i) => {
        if (i.customId === 'confirm_delete') {
            try {
                await targetChannel.delete();
                logger.info(`Channel ${targetChannel.name} deleted by ${interaction.user.tag}`);
            } catch (error) {
                await i.update({ content: `❌ Errore nell'eliminazione del canale: ${error.message}`, embeds: [], components: [] });
            }
        } else if (i.customId === 'cancel_delete') {
            await i.update({ content: '❌ Eliminazione annullata.', embeds: [], components: [] });
        }
        collector.stop();
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            interaction.editReply({ content: '⏰ Tempo scaduto.', embeds: [], components: [] });
        }
    });
}

async function handleRenameChannel(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const newName = interaction.options.getString('new_name');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(targetChannel.type)) {
        await interaction.reply({ content: '❌ Puoi rinominare solo canali testuali o vocali.', ephemeral: true });
        return;
    }

    if (newName.length < 1 || newName.length > 100) {
        await interaction.reply({ content: '❌ Il nome del canale deve essere tra 1 e 100 caratteri.', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('✏️ Conferma Rinominazione')
        .setDescription(`Sei sicuro di voler rinominare il canale **${targetChannel.name}** a **${newName}**?`)
        .setColor(0x00ff00)
        .setFooter({ text: 'Scade in 30 secondi' });

    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_rename')
        .setLabel('Conferma')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✏️');

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_rename')
        .setLabel('Annulla')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    const filter = (i) => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

    collector.on('collect', async (i) => {
        if (i.customId === 'confirm_rename') {
            try {
                const oldName = targetChannel.name;
                await targetChannel.setName(newName);
                await i.update({ content: `✅ Canale rinominato da **${oldName}** a **${newName}**!`, embeds: [], components: [] });
                logger.info(`Channel ${oldName} renamed to ${newName} by ${interaction.user.tag}`);
            } catch (error) {
                await i.update({ content: `❌ Errore nella rinominazione del canale: ${error.message}`, embeds: [], components: [] });
            }
        } else if (i.customId === 'cancel_rename') {
            await i.update({ content: '❌ Rinominazione annullata.', embeds: [], components: [] });
        }
        collector.stop();
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            interaction.editReply({ content: '⏰ Tempo scaduto.', embeds: [], components: [] });
        }
    });
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
        await interaction.followup.send({ content: `✅ Ho eliminato ${messages.size} messaggi.`, ephemeral: true });
        logger.info(`Purge executed: ${messages.size} messages deleted by ${interaction.user.tag} in ${interaction.channel.name}`);
    } catch (error) {
        await interaction.followup.send({ content: `❌ Errore durante la purge: ${error.message}`, ephemeral: true });
        logger.error(`Purge error by ${interaction.user.tag}: ${error.message}`);
    }
}

async function handlePing(interaction) {
    const latency = Math.round(client.ws.ping);
    await interaction.reply({ content: `🏓 Pong! Latenza: ${latency}ms`, ephemeral: true });
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

async function handleEmbed(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('Embed Creator')
        .setDescription('Usa il menu sottostante per modificare l\'embed.')
        .setColor(0x00ff00)
        .setFooter({ text: 'Valiance Bot - Embed Creator' });

    // This would need the EmbedCreatorView implementation
    await interaction.reply({ embeds: [embed], ephemeral: true });
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
            await interaction.reply({ content: `❌ Errore: ${error.message}`, ephemeral: true });
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
            await interaction.reply({ content: `❌ Errore: ${error.message}`, ephemeral: true });
            logger.error(`Error in /verify forceverify: ${error.message}`);
        }
    }
}

async function handleLogs(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const logsDir = '../logs';
    if (!fs.existsSync(logsDir)) {
        await interaction.reply({ content: '❌ Cartella logs non trovata.', ephemeral: true });
        return;
    }

    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    if (logFiles.length === 0) {
        await interaction.reply({ content: '❌ Nessun file di log trovato.', ephemeral: true });
        return;
    }

    // This would need a proper select menu implementation
    await interaction.reply({ content: '📄 Funzionalità logs in sviluppo...', ephemeral: true });
    logger.info(`/logs used by ${interaction.user.tag} in ${interaction.guild.name}`);
}

async function handleDelLogs(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    await interaction.reply({ content: '🗑️ Funzionalità dellogs in sviluppo...', ephemeral: true });
    logger.info(`/dellogs used by ${interaction.user.tag} in ${interaction.guild.name}`);
}

async function handleReloadLog(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    try {
        const logCog = client.cogs.get('log');
        if (logCog && logCog.reloadConfig) {
            logCog.reloadConfig();
            await interaction.reply({ content: '✅ Configurazione log ricaricata con successo!', ephemeral: true });
            logger.info(`Log config reloaded by ${interaction.user.tag}`);
        } else {
            await interaction.reply({ content: '❌ Cog Log non trovato.', ephemeral: true });
        }
    } catch (error) {
        await interaction.reply({ content: `❌ Errore nel ricaricare la configurazione log: ${error.message}`, ephemeral: true });
        logger.error(`Error reloading log config: ${error.message}`);
    }
}

async function handleReloadConfig(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    try {
        reloadGlobalConfig();
        await interaction.reply({ content: '✅ Configurazione globale ricaricata con successo!', ephemeral: true });
        logger.info(`Global config reloaded by ${interaction.user.tag}`);
    } catch (error) {
        await interaction.reply({ content: `❌ Errore nel ricaricare la configurazione globale: ${error.message}`, ephemeral: true });
        logger.error(`Error reloading global config: ${error.message}`);
    }
}

async function handleReloadAll(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    try {
        reloadAll();
        await interaction.reply({ content: '✅ Tutte le configurazioni ricaricate con successo!', ephemeral: true });
        logger.info(`All configs reloaded by ${interaction.user.tag}`);
    } catch (error) {
        await interaction.reply({ content: `❌ Errore nel ricaricare tutte le configurazioni: ${error.message}`, ephemeral: true });
        logger.error(`Error reloading all configs: ${error.message}`);
    }
}

async function handleSetLogChannel(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    await interaction.reply({ content: '⚙️ Funzionalità setlogchannel in sviluppo...', ephemeral: true });
    logger.info(`/setlogchannel used by ${interaction.user.tag} in ${interaction.guild.name}`);
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
    try {
        const joinRoleId = config.autorole_on_join_id;
        if (joinRoleId) {
            const role = member.guild.roles.cache.get(joinRoleId);
            if (role && !member.roles.cache.has(role.id)) {
                await member.roles.add(role, 'Auto-role on join (config)');
            }
        }
    } catch (error) {
        if (error.code !== 50013) { // Not missing permissions
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
    if (!oldMember.premiumSince && newMember.premiumSince) {
        if (!config.boost_channel_id) return;

        try {
            const boostChannel = newMember.guild.channels.cache.get(config.boost_channel_id);
            if (!boostChannel) return;

            const boostData = config.boost_message || {};
            
            let description = boostData.description || '{mention} ha boostato il server!';
            description = description.replace('{mention}', newMember.toString())
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

            embed.setAuthor({ name: newMember.user.username, iconURL: newMember.user.displayAvatarURL() });

            await boostChannel.send({ embeds: [embed] });
            logger.info(`Boost message sent for ${newMember.user.username}`);
        } catch (error) {
            logger.error(`Error sending boost message: ${error.message}`);
        }
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

    // Welcome reactions
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

    // Game session logic
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

        session.textChannel = await guild.channels.create({
            name: 'cw-interna',
            type: ChannelType.GuildText,
            parent: category,
            topic: 'CW - Team Rosso vs Verde',
            permissionOverwrites: overwrites
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

// Global functions for cogs
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

// Export for use in cogs
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