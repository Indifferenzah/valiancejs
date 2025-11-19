const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config.json');
const COUNTERS_PATH = path.join(__dirname, 'counter.json');

class CountersCog {
    constructor(client) {
        this.client = client;
        this.config = loadJsonSync(CONFIG_PATH);
        this.counterChannels = {};
        this.counterCache = {};
        this.pendingUpdates = {};
        this.updateInterval = null;
        this.bootstrapped = false;
    }

    async loadExistingCounters() {
        const state = loadJsonSync(COUNTERS_PATH, { active_counters: {} });
        for (const [guildId, channels] of Object.entries(state.active_counters || {})) {
            try {
                const guild = this.client.guilds.cache.get(guildId);
                if (!guild) continue;
                
                this.counterChannels[guildId] = {};
                this.counterCache[guildId] = {};
                this.pendingUpdates[guildId] = true;
                
                for (const [ctype, channelId] of Object.entries(channels)) {
                    const channel = guild.channels.cache.get(channelId);
                    if (channel && channel.type === ChannelType.GuildVoice) {
                        this.counterChannels[guildId][ctype] = channel;
                    }
                }
            } catch (error) {
                logger.error(`Error loading counter for guild ${guildId}: ${error.message}`);
            }
        }
    }

    startCounterLoop() {
        if (this.updateInterval) return;
        
        this.updateInterval = setInterval(async () => {
            for (const [guildId, pending] of Object.entries(this.pendingUpdates)) {
                if (pending) {
                    const guild = this.client.guilds.cache.get(guildId);
                    if (guild) {
                        await this.updateGuildCounters(guild);
                    }
                    this.pendingUpdates[guildId] = false;
                }
            }
        }, 60000); // Every minute
        
        logger.info('Counter update loop started');
    }

    stopCounterLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async updateGuildCounters(guild, force = false) {
        if (!this.counterChannels[guild.id]) return;
        
        const countersConfig = this.config.counters || {};
        const roleId = countersConfig.member_role_id;
        
        const nameTemplates = {
            total_members: countersConfig.total_members_name || '👥 Membri: {count}',
            role_members: countersConfig.role_members_name || '⭐ Membri Clan: {count}',
            bots: countersConfig.bots_name || '🤖 Bot: {count}',
            total_channels: countersConfig.total_channels_name || '📺 Canali: {count}',
            text_channels: countersConfig.text_channels_name || '💬 Testo: {count}',
            voice_channels: countersConfig.voice_channels_name || '🔊 Voce: {count}'
        };
        
        for (const [ctype, channel] of Object.entries(this.counterChannels[guild.id])) {
            try {
                let count = 0;
                
                switch (ctype) {
                    case 'total_members':
                        count = guild.members.cache.filter(m => !m.user.bot).size;
                        break;
                    case 'role_members':
                        if (roleId) {
                            const role = guild.roles.cache.get(roleId);
                            if (role) {
                                count = role.members.filter(m => !m.user.bot).size;
                            }
                        }
                        break;
                    case 'bots':
                        count = guild.members.cache.filter(m => m.user.bot).size;
                        break;
                    case 'total_channels':
                        count = guild.channels.cache.size;
                        break;
                    case 'text_channels':
                        count = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
                        break;
                    case 'voice_channels':
                        count = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
                        break;
                }
                
                const prevCount = this.counterCache[guild.id]?.[ctype];
                if (force || prevCount !== count) {
                    const newName = nameTemplates[ctype].replace('{count}', count.toString());
                    await channel.setName(newName);
                    
                    if (!this.counterCache[guild.id]) this.counterCache[guild.id] = {};
                    this.counterCache[guild.id][ctype] = count;
                    
                    logger.info(`Updated ${ctype} counter for ${guild.name}: ${newName}`);
                }
            } catch (error) {
                if (error.code === 50013) {
                    logger.error(`Missing permissions to update counter ${ctype} in ${guild.name}`);
                } else {
                    logger.error(`Error updating counter ${ctype} in ${guild.name}: ${error.message}`);
                }
            }
        }
    }

    setupEventListeners() {
        this.client.on('guildMemberAdd', (member) => {
            this.pendingUpdates[member.guild.id] = true;
        });
        
        this.client.on('guildMemberRemove', (member) => {
            this.pendingUpdates[member.guild.id] = true;
        });
        
        this.client.on('channelCreate', (channel) => {
            if (channel.guild) {
                this.pendingUpdates[channel.guild.id] = true;
            }
        });
        
        this.client.on('channelDelete', (channel) => {
            if (channel.guild) {
                this.pendingUpdates[channel.guild.id] = true;
            }
        });
        
        this.client.on('guildMemberUpdate', (oldMember, newMember) => {
            if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
                this.pendingUpdates[newMember.guild.id] = true;
            }
        });
    }

    async onReady() {
        if (this.bootstrapped) return;
        this.bootstrapped = true;
        
        await this.loadExistingCounters();
        this.startCounterLoop();
        this.setupEventListeners();
        
        logger.info('Counter cog ready');
    }

    getCommands() {
        return [
            new SlashCommandBuilder()
                .setName('counter')
                .setDescription('Gestione dei counter')
                .addSubcommand(subcommand =>
                    subcommand.setName('start')
                        .setDescription('Crea e avvia i counter selezionati')
                        .addStringOption(option =>
                            option.setName('types')
                                .setDescription('Tipi di counter separati da virgola (default: total_members,role_members)')
                                .setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand.setName('stop')
                        .setDescription('Ferma e rimuove tutti i counter'))
                .addSubcommand(subcommand =>
                    subcommand.setName('enable')
                        .setDescription('Abilita un singolo counter')
                        .addStringOption(option =>
                            option.setName('counter_type')
                                .setDescription('Tipo di counter')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Total Members', value: 'total_members' },
                                    { name: 'Role Members', value: 'role_members' },
                                    { name: 'Bots', value: 'bots' },
                                    { name: 'Total Channels', value: 'total_channels' },
                                    { name: 'Text Channels', value: 'text_channels' },
                                    { name: 'Voice Channels', value: 'voice_channels' }
                                ))
                        .addChannelOption(option =>
                            option.setName('channel')
                                .setDescription('Canale voce esistente (opzionale)')
                                .addChannelTypes(ChannelType.GuildVoice)
                                .setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand.setName('disable')
                        .setDescription('Disabilita un singolo counter')
                        .addStringOption(option =>
                            option.setName('counter_type')
                                .setDescription('Tipo di counter')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Total Members', value: 'total_members' },
                                    { name: 'Role Members', value: 'role_members' },
                                    { name: 'Bots', value: 'bots' },
                                    { name: 'Total Channels', value: 'total_channels' },
                                    { name: 'Text Channels', value: 'text_channels' },
                                    { name: 'Voice Channels', value: 'voice_channels' }
                                )))
                .addSubcommand(subcommand =>
                    subcommand.setName('setname')
                        .setDescription('Imposta il template del nome per un counter')
                        .addStringOption(option =>
                            option.setName('counter_type')
                                .setDescription('Tipo di counter')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Total Members', value: 'total_members' },
                                    { name: 'Role Members', value: 'role_members' },
                                    { name: 'Bots', value: 'bots' },
                                    { name: 'Total Channels', value: 'total_channels' },
                                    { name: 'Text Channels', value: 'text_channels' },
                                    { name: 'Voice Channels', value: 'voice_channels' }
                                ))
                        .addStringOption(option =>
                            option.setName('template')
                                .setDescription('Nuovo nome con {count} come segnaposto')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand.setName('setrole')
                        .setDescription('Imposta il ruolo per il counter role_members')
                        .addRoleOption(option =>
                            option.setName('role')
                                .setDescription('Ruolo usato per il counter role_members')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand.setName('list')
                        .setDescription('Lista dei counter attivi in questo server'))
        ];
    }

    async handleCommand(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'start':
                await this.handleCounterStart(interaction);
                break;
            case 'stop':
                await this.handleCounterStop(interaction);
                break;
            case 'enable':
                await this.handleCounterEnable(interaction);
                break;
            case 'disable':
                await this.handleCounterDisable(interaction);
                break;
            case 'setname':
                await this.handleCounterSetName(interaction);
                break;
            case 'setrole':
                await this.handleCounterSetRole(interaction);
                break;
            case 'list':
                await this.handleCounterList(interaction);
                break;
        }
    }

    async handleCounterStart(interaction) {
        await interaction.reply({ content: '🔄 Creazione canali counter in corso...', ephemeral: false });
        
        const typesStr = interaction.options.getString('types');
        let selected = ['total_members', 'role_members'];
        
        if (typesStr) {
            const validTypes = ['total_members', 'role_members', 'bots', 'total_channels', 'text_channels', 'voice_channels'];
            selected = typesStr.split(',').map(t => t.trim()).filter(t => validTypes.includes(t));
        }
        
        if (selected.length === 0) {
            await interaction.followUp({ content: '❌ Nessun counter valido selezionato.', ephemeral: true });
            return;
        }
        
        const guild = interaction.guild;
        const countersConfig = this.config.counters || {};
        const created = {};
        let position = 0;
        
        for (const ctype of selected) {
            try {
                let count = 0;
                
                switch (ctype) {
                    case 'total_members':
                        count = guild.members.cache.filter(m => !m.user.bot).size;
                        break;
                    case 'role_members':
                        if (countersConfig.member_role_id) {
                            const role = guild.roles.cache.get(countersConfig.member_role_id);
                            if (role) count = role.members.filter(m => !m.user.bot).size;
                        }
                        break;
                    case 'bots':
                        count = guild.members.cache.filter(m => m.user.bot).size;
                        break;
                    case 'total_channels':
                        count = guild.channels.cache.size;
                        break;
                    case 'text_channels':
                        count = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
                        break;
                    case 'voice_channels':
                        count = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
                        break;
                }
                
                const nameTemplates = {
                    total_members: countersConfig.total_members_name || '👥 Membri: {count}',
                    role_members: countersConfig.role_members_name || '⭐ Membri Clan: {count}',
                    bots: countersConfig.bots_name || '🤖 Bot: {count}',
                    total_channels: countersConfig.total_channels_name || '📺 Canali: {count}',
                    text_channels: countersConfig.text_channels_name || '💬 Testo: {count}',
                    voice_channels: countersConfig.voice_channels_name || '🔊 Voce: {count}'
                };
                
                const name = nameTemplates[ctype].replace('{count}', count.toString());
                const channel = await guild.channels.create({
                    name,
                    type: ChannelType.GuildVoice,
                    position,
                    permissionOverwrites: [{
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.Connect]
                    }]
                });
                
                created[ctype] = channel;
                position++;
            } catch (error) {
                logger.error(`Error creating counter ${ctype}: ${error.message}`);
            }
        }
        
        if (Object.keys(created).length > 0) {
            this.counterChannels[guild.id] = created;
            
            const state = loadJsonSync(COUNTERS_PATH, { active_counters: {} });
            if (!state.active_counters[guild.id]) state.active_counters[guild.id] = {};
            
            for (const [ctype, channel] of Object.entries(created)) {
                state.active_counters[guild.id][ctype] = channel.id;
            }
            
            saveJsonSync(COUNTERS_PATH, state);
            await this.updateGuildCounters(guild, true);
            
            await interaction.followUp({ content: `✅ Counter creati: ${Object.keys(created).join(', ')}`, ephemeral: false });
        } else {
            await interaction.followUp({ content: '❌ Nessun counter creato.', ephemeral: true });
        }
    }

    async handleCounterStop(interaction) {
        const guild = interaction.guild;
        
        if (!this.counterChannels[guild.id]) {
            await interaction.reply({ content: '❌ Nessun counter attivo.', ephemeral: true });
            return;
        }
        
        await interaction.reply({ content: '🔄 Rimozione dei counter...', ephemeral: false });
        
        for (const [ctype, channel] of Object.entries(this.counterChannels[guild.id])) {
            try {
                await channel.delete();
            } catch (error) {
                logger.error(`Error deleting counter ${ctype}: ${error.message}`);
            }
        }
        
        delete this.counterChannels[guild.id];
        
        const state = loadJsonSync(COUNTERS_PATH, { active_counters: {} });
        if (state.active_counters[guild.id]) {
            delete state.active_counters[guild.id];
            saveJsonSync(COUNTERS_PATH, state);
        }
        
        await interaction.followUp({ content: '✅ Tutti i counter sono stati rimossi.', ephemeral: false });
    }

    async handleCounterEnable(interaction) {
        const guild = interaction.guild;
        const ctype = interaction.options.getString('counter_type');
        const channel = interaction.options.getChannel('channel');
        
        const countersConfig = this.config.counters || {};
        
        let count = 0;
        switch (ctype) {
            case 'total_members':
                count = guild.members.cache.filter(m => !m.user.bot).size;
                break;
            case 'role_members':
                if (countersConfig.member_role_id) {
                    const role = guild.roles.cache.get(countersConfig.member_role_id);
                    if (role) count = role.members.filter(m => !m.user.bot).size;
                }
                break;
            case 'bots':
                count = guild.members.cache.filter(m => m.user.bot).size;
                break;
            case 'total_channels':
                count = guild.channels.cache.size;
                break;
            case 'text_channels':
                count = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
                break;
            case 'voice_channels':
                count = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
                break;
        }
        
        const nameTemplates = {
            total_members: countersConfig.total_members_name || '👥 Membri: {count}',
            role_members: countersConfig.role_members_name || '⭐ Membri Clan: {count}',
            bots: countersConfig.bots_name || '🤖 Bot: {count}',
            total_channels: countersConfig.total_channels_name || '📺 Canali: {count}',
            text_channels: countersConfig.text_channels_name || '💬 Testo: {count}',
            voice_channels: countersConfig.voice_channels_name || '🔊 Voce: {count}'
        };
        
        const name = nameTemplates[ctype].replace('{count}', count.toString());
        
        try {
            let targetChannel = channel;
            
            if (!targetChannel) {
                const position = Object.keys(this.counterChannels[guild.id] || {}).length;
                targetChannel = await guild.channels.create({
                    name,
                    type: ChannelType.GuildVoice,
                    position,
                    permissionOverwrites: [{
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.Connect]
                    }]
                });
            } else {
                await targetChannel.setName(name);
            }
            
            if (!this.counterChannels[guild.id]) this.counterChannels[guild.id] = {};
            this.counterChannels[guild.id][ctype] = targetChannel;
            
            const state = loadJsonSync(COUNTERS_PATH, { active_counters: {} });
            if (!state.active_counters[guild.id]) state.active_counters[guild.id] = {};
            state.active_counters[guild.id][ctype] = targetChannel.id;
            saveJsonSync(COUNTERS_PATH, state);
            
            await this.updateGuildCounters(guild, true);
            
            await interaction.reply({ content: `✅ Counter \`${ctype}\` abilitato su ${targetChannel}`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: `❌ Errore nell'abilitazione del counter: ${error.message}`, ephemeral: true });
        }
    }

    async handleCounterDisable(interaction) {
        const guild = interaction.guild;
        const ctype = interaction.options.getString('counter_type');
        
        if (!this.counterChannels[guild.id] || !this.counterChannels[guild.id][ctype]) {
            await interaction.reply({ content: '❌ Questo counter non è attivo.', ephemeral: true });
            return;
        }
        
        const channel = this.counterChannels[guild.id][ctype];
        
        try {
            await channel.delete();
        } catch (error) {
            logger.error(`Error deleting counter ${ctype}: ${error.message}`);
        }
        
        delete this.counterChannels[guild.id][ctype];
        
        const state = loadJsonSync(COUNTERS_PATH, { active_counters: {} });
        if (state.active_counters[guild.id] && state.active_counters[guild.id][ctype]) {
            delete state.active_counters[guild.id][ctype];
            if (Object.keys(state.active_counters[guild.id]).length === 0) {
                delete state.active_counters[guild.id];
            }
            saveJsonSync(COUNTERS_PATH, state);
        }
        
        await interaction.reply({ content: `✅ Counter \`${ctype}\` disabilitato e canale eliminato.`, ephemeral: true });
    }

    async handleCounterSetName(interaction) {
        const ctype = interaction.options.getString('counter_type');
        const template = interaction.options.getString('template');
        
        if (!this.config.counters) this.config.counters = {};
        this.config.counters[`${ctype}_name`] = template;
        saveJsonSync(CONFIG_PATH, this.config);
        
        await interaction.reply({ content: `✅ Template per \`${ctype}\` aggiornato a: ${template}`, ephemeral: true });
    }

    async handleCounterSetRole(interaction) {
        const role = interaction.options.getRole('role');
        
        if (!this.config.counters) this.config.counters = {};
        this.config.counters.member_role_id = role.id;
        saveJsonSync(CONFIG_PATH, this.config);
        
        await interaction.reply({ content: `✅ Ruolo per \`role_members\` impostato a ${role.name}`, ephemeral: true });
    }

    async handleCounterList(interaction) {
        const guild = interaction.guild;
        const active = this.counterChannels[guild.id] || {};
        
        if (Object.keys(active).length === 0) {
            await interaction.reply({ content: 'ℹ️ Nessun counter attivo.', ephemeral: true });
            return;
        }
        
        const { EmbedBuilder } = require('discord.js');
        const desc = Object.entries(active).map(([ctype, channel]) => 
            `\`${ctype}\` → ${channel} (ID: ${channel.id})`
        ).join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle('Counter attivi')
            .setDescription(desc)
            .setColor(0x2ecc71);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

function setup(client) {
    const cog = new CountersCog(client);
    
    // Handle ready event
    client.once('ready', async () => {
        await cog.onReady();
    });
    
    // Handle interactions
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand() && interaction.commandName === 'counter') {
            await cog.handleCommand(interaction);
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.getCommands());
    
    return cog;
}

module.exports = { setup, CountersCog };