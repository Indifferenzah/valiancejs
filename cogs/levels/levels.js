const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const { loadJson, saveJson, loadJsonSync } = require('../../utils/jsonStore');

const CONFIG_PATH = path.join(__dirname, 'levels.json');
const DATA_PATH = path.join(__dirname, '../../data/levels.json');

function loadConfig() {
    try {
        return loadJsonSync(CONFIG_PATH);
    } catch (error) {
        return {
            enabled: true,
            text_xp: {
                min: 5,
                max: 15,
                cooldown_seconds: 60,
                excluded_channel_ids: [],
                excluded_role_ids: [],
                multiplier_roles: {}
            },
            voice_xp: {
                enabled: true,
                per_min_min: 2,
                per_min_max: 5,
                exclude_muted: true,
                exclude_deaf: true,
                exclude_afk_channel_ids: [],
                excluded_role_ids: [],
                multiplier_roles: {}
            },
            leaderboard: {
                page_size: 10
            },
            rank_card: {
                width: 934,
                height: 282,
                background: "assets/rankcard/rank_black.png",
                bar_color: "#14ff72",
                bar_bg: "#1f1f1f",
                text_color: "#ffffff",
                font_path: "assets/rankcard/Roboto-Bold.ttf"
            }
        };
    }
}

function userHasExcludedRole(member, roleIds) {
    return roleIds.some(roleId => member.roles.cache.has(roleId.toString()));
}

function getMultiplier(member, mapping) {
    let mult = 1.0;
    for (const [roleId, factor] of Object.entries(mapping)) {
        if (member.roles.cache.has(roleId.toString())) {
            mult = Math.max(mult, parseFloat(factor));
        }
    }
    return mult;
}

function levelFromXp(totalXp) {
    let level = 0;
    let xp = totalXp;
    
    while (true) {
        const needed = 5 * level * level + 50 * level + 100;
        if (xp < needed) {
            return { level, currentXp: xp, neededXp: needed };
        }
        xp -= needed;
        level++;
    }
}

class LevelsCog {
    constructor(client) {
        this.client = client;
        this.config = loadConfig();
        this.voiceInterval = null;
    }

    async startVoiceLoop() {
        if (this.voiceInterval) return;
        
        this.voiceInterval = setInterval(async () => {
            await this.processVoiceXp();
        }, 60000); // Every minute
    }

    stopVoiceLoop() {
        if (this.voiceInterval) {
            clearInterval(this.voiceInterval);
            this.voiceInterval = null;
        }
    }

    async processVoiceXp() {
        try {
            if (!this.config.voice_xp?.enabled) return;
            
            const vcfg = this.config.voice_xp;
            const perMin = Math.floor(Math.random() * (vcfg.per_min_max - vcfg.per_min_min + 1)) + vcfg.per_min_min;
            
            for (const guild of this.client.guilds.cache.values()) {
                for (const vc of guild.channels.cache.filter(c => c.type === 2).values()) { // Voice channels
                    if (vcfg.exclude_afk_channel_ids?.includes(vc.id)) continue;
                    
                    const members = vc.members.filter(m => !m.user.bot);
                    for (const member of members.values()) {
                        if (vcfg.exclude_muted && (member.voice.selfMute || member.voice.serverMute)) continue;
                        if (vcfg.exclude_deaf && (member.voice.selfDeaf || member.voice.serverDeaf)) continue;
                        if (userHasExcludedRole(member, vcfg.excluded_role_ids || [])) continue;
                        
                        const mult = getMultiplier(member, vcfg.multiplier_roles || {});
                        const amount = Math.floor(perMin * mult);
                        
                        await this.addXp(guild.id, member.id, 0, amount);
                    }
                }
            }
        } catch (error) {
            console.error('Error in voice XP processing:', error);
        }
    }

    async addXp(guildId, userId, textXp = 0, voiceXp = 0) {
        try {
            const data = await loadJson(DATA_PATH, {});
            const guildData = data[guildId] || { users: {} };
            const userData = guildData.users[userId] || { text_xp: 0, voice_xp: 0, last_msg_xp_at: 0 };
            
            userData.text_xp = (userData.text_xp || 0) + textXp;
            userData.voice_xp = (userData.voice_xp || 0) + voiceXp;
            
            guildData.users[userId] = userData;
            data[guildId] = guildData;
            
            await saveJson(DATA_PATH, data);
        } catch (error) {
            console.error('Error adding XP:', error);
        }
    }

    async generateRankEmbed(member, mode = 'text') {
        const cfg = this.config.rank_embed || {};
        
        const data = await loadJson(DATA_PATH, {});
        const userData = data[member.guild.id]?.users?.[member.id] || { text_xp: 0, voice_xp: 0 };
        
        const xp = mode === 'text' ? userData.text_xp : userData.voice_xp;
        const { level, currentXp, neededXp } = levelFromXp(xp);
        const progress = neededXp > 0 ? Math.floor((currentXp / neededXp) * 100) : 100;
        
        const embed = new EmbedBuilder()
            .setTitle(cfg.title || 'Rank Card')
            .setDescription((cfg.description || '{user} - Livello {level} • {mode}')
                .replace('{user}', member.displayName)
                .replace('{level}', level.toString())
                .replace('{mode}', mode === 'text' ? 'Text' : 'Voice'))
            .setColor(parseInt((cfg.color || '#14ff72').replace('#', ''), 16));

        const thumbnail = cfg.thumbnail || '{avatar}';
        if (thumbnail.includes('{avatar}')) {
            embed.setThumbnail(member.user.displayAvatarURL());
        } else if (thumbnail) {
            embed.setThumbnail(thumbnail);
        }

        for (const field of cfg.fields || []) {
            const name = (field.name || '')
                .replace('{xp}', xp.toString())
                .replace('{remaining}', (neededXp - currentXp).toString())
                .replace('{progress}', progress.toString());
            const value = (field.value || '')
                .replace('{xp}', xp.toString())
                .replace('{remaining}', (neededXp - currentXp).toString())
                .replace('{progress}', progress.toString());
            
            embed.addFields({ name, value, inline: field.inline !== false });
        }

        if (cfg.footer) {
            embed.setFooter({ text: cfg.footer });
        }

        return embed;
    }

    getCommands() {
        return [
            new SlashCommandBuilder()
                .setName('rank')
                .setDescription('Mostra la tua rank card (text/voice)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente da mostrare')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('mode')
                        .setDescription('text o voice')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Text', value: 'text' },
                            { name: 'Voice', value: 'voice' }
                        )),
            
            new SlashCommandBuilder()
                .setName('leaderboard')
                .setDescription('Mostra la classifica XP')
                .addStringOption(option =>
                    option.setName('mode')
                        .setDescription('text o voice')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Text', value: 'text' },
                            { name: 'Voice', value: 'voice' }
                        ))
                .addIntegerOption(option =>
                    option.setName('page')
                        .setDescription('Pagina (da 1)')
                        .setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('givexp')
                .setDescription('Dai XP a un utente (solo admin)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Quantità')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('mode')
                        .setDescription('text o voice')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Text', value: 'text' },
                            { name: 'Voice', value: 'voice' }
                        )),
            
            new SlashCommandBuilder()
                .setName('setxp')
                .setDescription('Setta gli XP di un utente (solo admin)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Quantità')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('mode')
                        .setDescription('text o voice')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Text', value: 'text' },
                            { name: 'Voice', value: 'voice' }
                        ))
        ];
    }

    async handleCommand(interaction) {
        const { commandName } = interaction;

        switch (commandName) {
            case 'rank':
                await this.handleRank(interaction);
                break;
            case 'leaderboard':
                await this.handleLeaderboard(interaction);
                break;
            case 'givexp':
                await this.handleGiveXp(interaction);
                break;
            case 'setxp':
                await this.handleSetXp(interaction);
                break;
        }
    }

    async handleRank(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);
        const mode = interaction.options.getString('mode') || 'text';
        
        const embed = await this.generateRankEmbed(member, mode);
        await interaction.reply({ embeds: [embed] });
    }

    async handleLeaderboard(interaction) {
        await interaction.deferReply();
        
        const mode = interaction.options.getString('mode') || 'text';
        const page = Math.max(1, interaction.options.getInteger('page') || 1);
        const pageSize = this.config.leaderboard?.page_size || 10;
        const offset = (page - 1) * pageSize;
        
        const data = await loadJson(DATA_PATH, {});
        const users = data[interaction.guild.id]?.users || {};
        
        const items = Object.entries(users).map(([userId, userData]) => ({
            userId,
            xp: mode === 'text' ? (userData.text_xp || 0) : (userData.voice_xp || 0)
        })).sort((a, b) => b.xp - a.xp);
        
        const sliceItems = items.slice(offset, offset + pageSize);
        
        if (sliceItems.length === 0) {
            await interaction.followup.send('Nessun dato in classifica.');
            return;
        }
        
        const description = [];
        for (let i = 0; i < sliceItems.length; i++) {
            const item = sliceItems[i];
            const rank = offset + i + 1;
            const user = await interaction.guild.members.fetch(item.userId).catch(() => null);
            const userMention = user ? user.toString() : item.userId;
            description.push(`**#${rank}** ${userMention} — ${item.xp} XP`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`Classifica ${mode.charAt(0).toUpperCase() + mode.slice(1)}`)
            .setDescription(description.join('\n'))
            .setColor(0x14ff72);
        
        await interaction.followup.send({ embeds: [embed] });
    }

    async handleGiveXp(interaction) {
        if (!ownerOrHasPermissions('Administrator')(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }
        
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const mode = interaction.options.getString('mode') || 'text';
        
        const textXp = mode === 'text' ? amount : 0;
        const voiceXp = mode === 'voice' ? amount : 0;
        
        await this.addXp(interaction.guild.id, user.id, textXp, voiceXp);
        
        await interaction.reply({
            content: `Aggiunti ${amount} XP ${mode === 'text' ? 'testo' : 'voice'} a ${user.toString()}.`,
            ephemeral: true
        });
    }

    async handleSetXp(interaction) {
        if (!ownerOrHasPermissions('Administrator')(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }
        
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const mode = interaction.options.getString('mode') || 'text';
        
        try {
            const data = await loadJson(DATA_PATH, {});
            const guildData = data[interaction.guild.id] || { users: {} };
            const userData = guildData.users[user.id] || { text_xp: 0, voice_xp: 0, last_msg_xp_at: 0 };
            
            if (mode === 'text') {
                userData.text_xp = amount;
            } else {
                userData.voice_xp = amount;
            }
            
            guildData.users[user.id] = userData;
            data[interaction.guild.id] = guildData;
            
            await saveJson(DATA_PATH, data);
            
            await interaction.reply({
                content: `Settati ${amount} XP ${mode === 'text' ? 'testo' : 'voice'} per ${user.toString()}.`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({ content: `❌ Errore: ${error.message}`, ephemeral: true });
        }
    }
}

function setup(client) {
    const cog = new LevelsCog(client);
    
    // Register commands
    const commands = cog.getCommands();
    for (const command of commands) {
        client.application?.commands.create(command);
    }

    // Handle message XP
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (!cog.config.enabled) return;
        
        const textCfg = cog.config.text_xp || {};
        if (textCfg.excluded_channel_ids?.includes(message.channel.id)) return;
        if (message.member && userHasExcludedRole(message.member, textCfg.excluded_role_ids || [])) return;
        
        const now = Math.floor(Date.now() / 1000);
        const cooldown = textCfg.cooldown_seconds || 60;
        
        const data = await loadJson(DATA_PATH, {});
        const userData = data[message.guild.id]?.users?.[message.author.id] || { text_xp: 0, voice_xp: 0, last_msg_xp_at: 0 };
        
        const lastXpAt = userData.last_msg_xp_at || 0;
        if (lastXpAt && now - lastXpAt < cooldown) return;
        
        const amount = Math.floor(Math.random() * (textCfg.max - textCfg.min + 1)) + textCfg.min;
        const mult = getMultiplier(message.member, textCfg.multiplier_roles || {});
        const finalAmount = Math.floor(amount * mult);
        
        userData.text_xp = (userData.text_xp || 0) + finalAmount;
        userData.last_msg_xp_at = now;
        
        const guildData = data[message.guild.id] || { users: {} };
        guildData.users[message.author.id] = userData;
        data[message.guild.id] = guildData;
        
        await saveJson(DATA_PATH, data);
    });

    // Handle interactions
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isCommand()) {
            const commandNames = ['rank', 'leaderboard', 'givexp', 'setxp'];
            if (commandNames.includes(interaction.commandName)) {
                await cog.handleCommand(interaction);
            }
        }
    });

    // Start voice loop when ready
    client.once('ready', () => {
        cog.startVoiceLoop();
    });

    return cog;
}

module.exports = { setup, LevelsCog };