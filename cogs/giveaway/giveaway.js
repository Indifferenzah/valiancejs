const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    PermissionFlagsBits,
    Colors
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const baseLogger = require('../../utils/logger');

const logger = baseLogger.createScopedLogger
    ? baseLogger.createScopedLogger('giveaway')
    : baseLogger;

const DATA_DIR = path.join(__dirname, 'data');
const BLACKLIST_PATH = path.join(__dirname, 'blacklist.json');
const CONFIG_PATH = path.join(__dirname, 'giveaway.json');

const DEFAULT_CONFIG = {
    embed_template: {
        title: '🎉 {prize}',
        description: 'Host: {host}\nPremio: {prize}\nTermina {expire}',
        thumbnail: null,
        footer_text: 'Partecipa cliccando il bottone!',
        footer_use_server_icon: true,
        color: 'gold'
    },
    end_message: '🎉 Giveaway terminato! Vincitore: {winner} — Premio: {prize} — Finito {expire} (Host: {host})'
};

const DURATION_UNITS = { d: 86400, h: 3600, m: 60, s: 1 };

function ensureDataDir() {
    return fsp.mkdir(DATA_DIR, { recursive: true });
}

function filePath(messageId) {
    return path.join(DATA_DIR, `${messageId}.json`);
}

function utcIso() {
    return new Date().toISOString();
}

function utcEpoch() {
    return Math.floor(Date.now() / 1000);
}

function parseDuration(input) {
    if (!input) return null;
    let total = 0;
    let num = '';
    for (const ch of input.trim()) {
        if (/\d/.test(ch)) {
            num += ch;
            continue;
        }
        const unit = DURATION_UNITS[ch.toLowerCase()];
        if (unit && num) {
            total += Number(num) * unit;
            num = '';
        } else {
            return null;
        }
    }
    if (num) {
        total += Number(num);
    }
    return total > 0 ? total : null;
}

function formatDiscordTime(epoch) {
    return epoch ? `<t:${epoch}:R>` : '';
}

function renderTemplate(template, { prize, durationText, expireEpoch, hostMention, description = '', winnersText = null }) {
    if (!template) return '';
    let result = template;
    result = result.replace('{description}', description || '');
    result = result.replace('{prize}', prize || '');
    result = result.replace('{duration}', durationText || '');
    result = result.replace('{expire}', expireEpoch ? formatDiscordTime(expireEpoch) : '');
    result = result.replace('{host}', hostMention || '');
    if (winnersText !== null) {
        result = result.replace('{winner}', winnersText);
    }
    return result;
}

async function loadJson(file, fallback) {
    try {
        const raw = await fsp.readFile(file, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') return fallback;
        logger.error(`[Giveaway] Failed to read ${file}: ${error.message}`);
        return fallback;
    }
}

async function saveJson(file, data) {
    try {
        await fsp.mkdir(path.dirname(file), { recursive: true });
        await fsp.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        logger.error(`[Giveaway] Failed to write ${file}: ${error.message}`);
    }
}

async function loadConfig() {
    const cfg = await loadJson(CONFIG_PATH, DEFAULT_CONFIG);
    const merged = { ...DEFAULT_CONFIG, ...(cfg || {}) };
    merged.embed_template = {
        ...DEFAULT_CONFIG.embed_template,
        ...(merged.embed_template || {})
    };
    return merged;
}

async function loadBlacklist() {
    const raw = await loadJson(BLACKLIST_PATH, {});
    const normalized = {};

    if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.users)) {
            normalized['*'] = raw.users.map(String);
        }
        for (const [key, value] of Object.entries(raw)) {
            if (key === 'users') continue;
            if (Array.isArray(value)) {
                normalized[key] = value.map(String);
            }
        }
    }
    return normalized;
}

async function saveBlacklist(data) {
    await saveJson(BLACKLIST_PATH, data);
}

function eligibleEntrants(guildId, entrants, blacklist) {
    const guildKey = String(guildId);
    const blocked = new Set([
        ...(blacklist[guildKey] || []),
        ...(blacklist['*'] || [])
    ].map(String));
    return (entrants || []).map(String).filter(id => !blocked.has(id));
}

function parseColor(value) {
    try {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const v = value.trim().toLowerCase();
            const named = {
                red: Colors.Red,
                green: Colors.Green,
                blue: Colors.Blue,
                blurple: Colors.Blurple,
                gold: Colors.Gold,
                orange: Colors.Orange,
                purple: Colors.Purple,
                teal: Colors.Teal,
                dark_theme: Colors.DarkButNotBlack
            };
            if (named[v] !== undefined) return named[v];
            const hex = v.startsWith('#') ? v.slice(1) : v;
            const parsed = Number.parseInt(hex, 16);
            return Number.isNaN(parsed) ? null : parsed;
        }
    } catch (error) {
        return null;
    }
    return null;
}

function randomSample(pool, count) {
    const arr = [...pool];
    const winners = [];
    for (let i = 0; i < count && arr.length > 0; i++) {
        const idx = Math.floor(Math.random() * arr.length);
        winners.push(arr.splice(idx, 1)[0]);
    }
    return winners;
}

class GiveawayCog {
    constructor(client) {
        this.client = client;
        this._tempFiles = [];
        this._endLoop = null;
        this._endingGiveaways = new Set();

        this.commands = [
            new SlashCommandBuilder()
                .setName('giveaway')
                .setDescription('Sistema di giveaway')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addSubcommand(sub =>
                    sub.setName('create')
                        .setDescription('Crea un giveaway con pulsanti di partecipazione')
                        .addStringOption(opt => opt.setName('prize').setDescription('Premio').setRequired(true))
                        .addStringOption(opt => opt.setName('duration').setDescription('Durata es. 1d2h30m (alternativa a expire)'))
                        .addIntegerOption(opt => opt.setName('expire').setDescription('Timestamp UNIX di scadenza (alternativa a durata)'))
                        .addIntegerOption(opt => opt.setName('number_winners').setDescription('Numero vincitori').setMinValue(1))
                        .addStringOption(opt => opt.setName('description').setDescription('Descrizione del giveaway (supporta \\n)').setRequired(false)))
                .addSubcommand(sub =>
                    sub.setName('end')
                        .setDescription('Termina un giveaway')
                        .addStringOption(opt => opt.setName('message_id').setDescription('ID messaggio giveaway').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('remove')
                        .setDescription('Rimuovi forzatamente un membro dal giveaway')
                        .addStringOption(opt => opt.setName('message_id').setDescription('ID messaggio giveaway').setRequired(true))
                        .addUserOption(opt => opt.setName('user').setDescription('Utente da rimuovere').setRequired(true)))
                .addSubcommandGroup(group =>
                    group.setName('blacklist')
                        .setDescription('Gestisci la blacklist giveaway')
                        .addSubcommand(sub =>
                            sub.setName('add')
                                .setDescription('Aggiungi un utente in blacklist')
                                .addUserOption(opt => opt.setName('user').setDescription('Utente da aggiungere').setRequired(true)))
                        .addSubcommand(sub =>
                            sub.setName('remove')
                                .setDescription('Rimuovi un utente dalla blacklist')
                                .addUserOption(opt => opt.setName('user').setDescription('Utente da rimuovere').setRequired(true)))
                        .addSubcommand(sub =>
                            sub.setName('list')
                                .setDescription('Mostra la blacklist corrente'))),
            new SlashCommandBuilder()
                .setName('gwreroll')
                .setDescription('Estrai nuovi vincitori aggiuntivi (non sostituisce i precedenti)')
                .addStringOption(opt => opt.setName('message_id').setDescription('ID del messaggio giveaway').setRequired(true))
                .addIntegerOption(opt => opt.setName('count').setDescription('Quanti nuovi vincitori aggiungere').setMinValue(1))
        ];

        this.registerHandlers();
    }

    registerHandlers() {
        this.client.on('interactionCreate', async (interaction) => {
            try {
                if (interaction.isButton()) {
                    await this.handleButton(interaction);
                } else if (interaction.isChatInputCommand()) {
                    await this.handleSlash(interaction);
                }
            } catch (error) {
                logger.error(`[Giveaway] Error handling interaction: ${error.message}`);
                if (interaction.isRepliable() && !interaction.replied) {
                    await interaction.reply({ content: '❌ Errore durante la gestione del giveaway.', ephemeral: true });
                }
            }
        });

        this.client.once('ready', () => {
            this.onReady().catch(err => logger.error(`[Giveaway] onReady error: ${err.message}`));
        });
    }

    async onReady() {
        await ensureDataDir();
        if (!this._endLoop) {
            this._endLoop = setInterval(() => {
                this.endChecker().catch(err => logger.error(`[Giveaway] End checker error: ${err.message}`));
            }, 30000);
            this._endLoop.unref?.();
            logger.info('[Giveaway] End checker loop started on ready');
        }

        try {
            const now = utcEpoch();
            const files = await fsp.readdir(DATA_DIR);
            for (const fname of files) {
                if (!fname.endsWith('.json')) continue;
                const messageId = path.parse(fname).name;
                const data = await this.loadGiveaway(messageId);
                if (!data) continue;
                if (data.status === 'active') {
                    const expire = Number(data.expire_epoch || 0);
                    if (expire && expire <= now) {
                        logger.info(`[Giveaway] Catch-up ending giveaway ${messageId} (expired at ${expire})`);
                        await this.endGiveaway(messageId);
                    }
                }
            }
        } catch (error) {
            logger.error(`[Giveaway] Catch-up error: ${error.message}`);
        }
    }

    async handleSlash(interaction) {
        if (interaction.commandName === 'giveaway') {
            const subGroup = interaction.options.getSubcommandGroup(false);
            const sub = interaction.options.getSubcommand(false);
            if (subGroup === 'blacklist') {
                switch (sub) {
                    case 'add':
                        return this.handleBlacklistAdd(interaction);
                    case 'remove':
                        return this.handleBlacklistRemove(interaction);
                    case 'list':
                        return this.handleBlacklistList(interaction);
                    default:
                        return;
                }
            }
            switch (sub) {
                case 'create':
                    return this.handleCreate(interaction);
                case 'end':
                    return this.handleEnd(interaction);
                case 'remove':
                    return this.handleRemove(interaction);
                default:
                    return;
            }
        }

        if (interaction.commandName === 'gwreroll') {
            return this.handleReroll(interaction);
        }
    }

    async handleButton(interaction) {
        if (interaction.customId === 'gw_join') {
            return this.handleJoinLeave(interaction);
        }
        if (interaction.customId === 'gw_show') {
            return this.handleShowList(interaction);
        }
    }

    isOwnerOrAdmin(interaction) {
        return ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction);
    }

    async handleCreate(interaction) {
        if (!this.isOwnerOrAdmin(interaction)) {
            await interaction.reply({
                content: '⛔ Non hai i permessi per creare giveaway.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        let description = interaction.options.getString('description');
        if (description) {
            description = description.replace(/\\n/g, '\n');
        }

        const prize = interaction.options.getString('prize');
        const duration = interaction.options.getString('duration');
        const expireOpt = interaction.options.getInteger('expire');
        const numberWinners = interaction.options.getInteger('number_winners') || 1;

        let expireEpoch;
        let durationText = duration;

        if (expireOpt) {
            expireEpoch = Number(expireOpt);
        } else {
            const seconds = parseDuration(duration);
            if (!seconds) {
                await interaction.editReply(
                    '❌ Specifica una durata valida (es. 1d2h30m) o un expire timestamp valido.'
                );
                return;
            }
            expireEpoch = utcEpoch() + seconds;
        }

        const cfg = await loadConfig();
        const nowIso = utcIso();

        const base = {
            guild_id: interaction.guildId,
            channel_id: interaction.channelId,
            message_id: '0',
            prize,
            description, // ✅ ora funziona
            duration_text: durationText,
            expire_epoch: expireEpoch,
            number_winners: Math.max(1, numberWinners),
            host: interaction.user.id,
            created_by: interaction.user.id,
            created_at: nowIso,
            updated_at: nowIso,
            status: 'active',
            entrants: [],
            winners: [],
            end_message_template: cfg.end_message
        };

        const embed = await this.buildActiveEmbed(interaction.guild, base);
        const row = this.buildButtons();

        const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
        base.message_id = msg.id;
        await this.saveGiveaway(msg.id, base);

        await interaction.editReply(`✅ Giveaway creato in ${interaction.channel} (ID: \`${msg.id}\`) — termina ${formatDiscordTime(expireEpoch)}`);
    }

    async handleEnd(interaction) {
        if (!this.isOwnerOrAdmin(interaction)) {
            await interaction.reply({ content: '⛔ Non hai i permessi per terminare giveaway.', ephemeral: true });
            return;
        }
        const messageId = interaction.options.getString('message_id');
        await interaction.deferReply({ ephemeral: true });
        const { winners } = await this.endGiveaway(messageId);
        const mentions = winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Nessuno';
        await interaction.editReply(`✅ Giveaway \`${messageId}\` terminato. Nuovi vincitori: ${mentions}`);
    }

    async handleRemove(interaction) {
        if (!this.isOwnerOrAdmin(interaction)) {
            await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
            return;
        }
        const messageId = interaction.options.getString('message_id');
        const user = interaction.options.getUser('user');
        const data = await this.loadGiveaway(messageId);
        if (!data) {
            await interaction.reply({ content: '❌ Giveaway non trovato.', ephemeral: true });
            return;
        }
        const uid = String(user.id);
        const entrants = (data.entrants || []).map(String);
        const winners = (data.winners || []).map(String);
        const newEntrants = entrants.filter(x => x !== uid);
        const newWinners = winners.filter(x => x !== uid);
        if (newEntrants.length === entrants.length && newWinners.length === winners.length) {
            await interaction.reply({ content: 'ℹ️ Utente non presente tra iscritti o vincitori.', ephemeral: true });
            return;
        }
        data.entrants = newEntrants;
        data.winners = newWinners;
        data.updated_at = utcIso();
        await this.saveGiveaway(messageId, data);
        await interaction.reply({ content: `✅ Rimosso ${user} dal giveaway \`${messageId}\`.`, ephemeral: true });
    }

    async handleReroll(interaction) {
        if (!this.isOwnerOrAdmin(interaction)) {
            await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
            return;
        }
        const messageId = interaction.options.getString('message_id');
        const count = interaction.options.getInteger('count') || 1;
        const data = await this.loadGiveaway(messageId);
        if (!data) {
            await interaction.reply({ content: '❌ Giveaway non trovato.', ephemeral: true });
            return;
        }

        const blacklist = await loadBlacklist();
        const entrants = (data.entrants || []).map(String);
        const existing = new Set((data.winners || []).map(String));
        const pool = eligibleEntrants(data.guild_id, entrants, blacklist).filter(id => !existing.has(id));
        if (!pool.length) {
            await interaction.reply({ content: 'ℹ️ Nessun altro partecipante idoneo da estrarre.', ephemeral: true });
            return;
        }
        const k = Math.max(1, Math.min(pool.length, count));
        const newWinners = randomSample(pool, k);
        data.winners = Array.from(new Set([...existing, ...newWinners]));
        data.updated_at = utcIso();
        await this.saveGiveaway(messageId, data);

        const mentions = newWinners.map(id => `<@${id}>`).join(', ');
        const channel = await this.fetchChannel(data.channel_id);
        if (channel) {
            try {
                await channel.send(`🔁 Nuovo reroll per giveaway \`${messageId}\`! Vincitore/i: ${mentions}`);
            } catch (error) {
                logger.error(`[Giveaway] Error sending reroll message: ${error.message}`);
            }
        }
        await interaction.reply({ content: `✅ Reroll eseguito. Nuovi vincitori: ${mentions}`, ephemeral: true });
    }

    async handleBlacklistAdd(interaction) {
        if (!this.isOwnerOrAdmin(interaction)) {
            await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
            return;
        }
        const user = interaction.options.getUser('user');
        const bl = await loadBlacklist();
        const key = String(interaction.guildId);
        const users = new Set([...(bl[key] || []), String(user.id)]);
        bl[key] = Array.from(users);
        await saveBlacklist(bl);
        await interaction.reply({ content: `✅ ${user} aggiunto in blacklist per i giveaway.`, ephemeral: true });
    }

    async handleBlacklistRemove(interaction) {
        if (!this.isOwnerOrAdmin(interaction)) {
            await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
            return;
        }
        const user = interaction.options.getUser('user');
        const bl = await loadBlacklist();
        const key = String(interaction.guildId);
        const users = new Set(bl[key] || []);
        if (!users.has(String(user.id))) {
            await interaction.reply({ content: 'ℹ️ Utente non in blacklist.', ephemeral: true });
            return;
        }
        users.delete(String(user.id));
        bl[key] = Array.from(users);
        await saveBlacklist(bl);
        await interaction.reply({ content: `✅ ${user} rimosso dalla blacklist.`, ephemeral: true });
    }

    async handleBlacklistList(interaction) {
        const bl = await loadBlacklist();
        const key = String(interaction.guildId);
        const ids = (bl[key] || []).map(String);
        if (!ids.length) {
            await interaction.reply({ content: 'La blacklist è vuota.', ephemeral: true });
            return;
        }
        const mentions = [];
        for (const uid of ids) {
            const member = interaction.guild?.members?.cache.get(uid);
            mentions.push(member ? member.toString() : `<@${uid}>`);
        }
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🚫 Blacklist Giveaway')
                    .setDescription(mentions.join('\n'))
                    .setColor(Colors.Red)
            ],
            ephemeral: true
        });
    }

    async handleJoinLeave(interaction) {
        const messageId = interaction.message.id;
        const data = await this.loadGiveaway(messageId);
        if (!data) {
            await interaction.reply({ content: '❌ Giveaway non trovato o non inizializzato.', ephemeral: true });
            return;
        }
        if (data.status !== 'active') {
            await interaction.reply({ content: '⛔ Questo giveaway è terminato.', ephemeral: true });
            return;
        }

        const bl = await loadBlacklist();
        const guildKey = String(interaction.guildId);
        const blocked = new Set([...(bl[guildKey] || []), ...(bl['*'] || [])].map(String));
        if (blocked.has(String(interaction.user.id))) {
            await interaction.reply({ content: '🚫 Sei in blacklist e non puoi partecipare ai giveaway.', ephemeral: true });
            return;
        }

        const entrants = (data.entrants || []).map(String);
        const uid = String(interaction.user.id);
        let action;
        let color;
        if (entrants.includes(uid)) {
            data.entrants = entrants.filter(id => id !== uid);
            action = 'uscito dal';
            color = Colors.Red;
        } else {
            data.entrants = [...entrants, uid];
            action = 'entrato nel';
            color = Colors.Green;
        }
        data.updated_at = utcIso();
        await this.saveGiveaway(messageId, data);

        try {
            const embed = await this.buildActiveEmbed(interaction.guild, data);
            await interaction.message.edit({ embeds: [embed], components: [this.buildButtons()] });
        } catch (error) {
            logger.error(`[Giveaway] Failed to update giveaway embed ${messageId}: ${error.message}`);
        }

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`Sei ${action} giveaway. Attuali partecipanti: ${data.entrants.length}`)
                    .setColor(color)
            ],
            ephemeral: true
        });
    }

    async handleShowList(interaction) {
        const data = await this.loadGiveaway(interaction.message.id);
        if (!data) {
            await interaction.reply({ content: '❌ Giveaway non trovato o non inizializzato.', ephemeral: true });
            return;
        }
        const entrants = (data.entrants || []).map(String);
        if (!entrants.length) {
            await interaction.reply({ content: 'Nessun iscritto al momento.', ephemeral: true });
            return;
        }
        const mentions = [];
        for (const uid of entrants) {
            const member = interaction.guild?.members?.cache.get(uid);
            mentions.push(member ? member.toString() : `<@${uid}>`);
        }
        const text = mentions.join('\n');
        if (text.length > 1900) {
            const attachment = new AttachmentBuilder(Buffer.from(text, 'utf8'), { name: 'iscritti.txt' });
            await interaction.reply({
                content: `Iscritti totali: ${entrants.length}`,
                files: [attachment],
                ephemeral: true
            });
        } else {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`Iscritti (${entrants.length})`)
                        .setDescription(text)
                        .setColor(Colors.Blurple)
                ],
                ephemeral: true
            });
        }
    }

    buildButtons() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('gw_join')
                .setLabel('🎉 Partecipa')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('gw_show')
                .setLabel('👥 Mostra iscritti')
                .setStyle(ButtonStyle.Primary)
        );
    }

    async buildBaseEmbed(guild, data) {
        const cfg = await loadConfig();
        const et = cfg.embed_template || {};
        const color = parseColor(et.color) || Colors.Gold;

        const embed = new EmbedBuilder()
            .setTitle(renderTemplate(
                et.title || `🎉 ${data.title || 'Giveaway'}`,
                {
                    prize: data.prize,
                    durationText: data.duration_text,
                    expireEpoch: data.expire_epoch,
                    hostMention: `<@${data.host}>`
                }
            ))
            .setDescription(renderTemplate(
                et.description || data.description || '',
                {
                    prize: data.prize,
                    durationText: data.duration_text,
                    expireEpoch: data.expire_epoch,
                    hostMention: `<@${data.host}>`,
                    description: data.description
                }
            ))
            .setColor(color);

        if (et.thumbnail) {
            embed.setThumbnail(et.thumbnail);
        }
        const footerText = et.footer_text;
        const footerServerIcon = et.footer_use_server_icon;
        const iconUrl = footerServerIcon && guild?.icon ? guild.iconURL() : null;
        if (footerText || iconUrl) {
            embed.setFooter({ text: footerText || undefined, iconURL: iconUrl || undefined });
        }
        return embed;
    }

    async buildActiveEmbed(guild, data) {
        const embed = await this.buildBaseEmbed(guild, data);
        if (data.prize) {
            embed.addFields({ name: 'Premio', value: data.prize, inline: false });
        }
        embed.addFields(
            { name: 'Scade', value: formatDiscordTime(data.expire_epoch), inline: true },
            { name: 'Host', value: `<@${data.host}>`, inline: true },
            {
                name: `Partecipanti (${(data.entrants || []).length})`,
                value: 'Premi "Partecipa" per unirti',
                inline: false
            }
        );
        return embed;
    }

    async buildEndedEmbed(guild, data, originalEntrantsLength) {
        const embed = await this.buildBaseEmbed(guild, data);
        embed.setColor(Colors.Red);
        const winnersText = (data.winners || []).length
            ? data.winners.map(id => `<@${id}>`).join(', ')
            : 'Nessuno';
        embed.addFields(
            { name: 'Stato', value: 'Terminato', inline: true },
            { name: 'Vincitori', value: winnersText, inline: false },
            { name: 'Partecipanti', value: String(originalEntrantsLength || 0), inline: true }
        );
        return embed;
    }

    async loadGiveaway(messageId) {
        try {
            const raw = await fsp.readFile(filePath(messageId), 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error(`[Giveaway] Failed to load giveaway ${messageId}: ${error.message}`);
            }
            return null;
        }
    }

    async saveGiveaway(messageId, data) {
        await ensureDataDir();
        await saveJson(filePath(messageId), data);
    }

    async fetchChannel(channelId) {
        if (!channelId) return null;
        const cached = this.client.channels.cache.get(channelId);
        if (cached) return cached;
        try {
            return await this.client.channels.fetch(channelId);
        } catch {
            return null;
        }
    }

    async endGiveaway(messageId) {
        if (this._endingGiveaways.has(String(messageId))) {
            return { winners: [], message: null };
        }
        this._endingGiveaways.add(String(messageId));
        try {
            const data = await this.loadGiveaway(messageId);
            if (!data || data.status !== 'active') {
                return { winners: [], message: null };
            }
            const blacklist = await loadBlacklist();
            const entrants = (data.entrants || []).map(String);
            const pool = eligibleEntrants(data.guild_id, entrants, blacklist);
            const winnerCount = Math.min(pool.length, Number(data.number_winners || 1));
            const winners = winnerCount > 0 ? randomSample(pool, winnerCount) : [];

            data.winners = Array.from(new Set([...(data.winners || []).map(String), ...winners]));
            data.status = 'ended';
            data.updated_at = utcIso();
            await this.saveGiveaway(messageId, data);

            const channel = await this.fetchChannel(data.channel_id);
            let msg = null;
            if (channel) {
                try {
                    msg = await channel.messages.fetch(messageId);
                    const endedEmbed = await this.buildEndedEmbed(channel.guild, data, entrants.length);
                    await msg.edit({ embeds: [endedEmbed], components: [] });
                } catch (error) {
                    logger.error(`[Giveaway] Failed to edit ended giveaway message ${messageId}: ${error.message}`);
                }

                const template = data.end_message_template || (await loadConfig()).end_message || '';
                const winnersMentions = winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Nessuno';
                const text = renderTemplate(
                    template,
                    {
                        prize: data.prize,
                        durationText: data.duration_text,
                        expireEpoch: data.expire_epoch,
                        hostMention: `<@${data.host}>`,
                        winnersText: winnersMentions
                    }
                );
                if (text) {
                    try {
                        await channel.send(text);
                    } catch (error) {
                        logger.error(`[Giveaway] Failed to send end announcement for ${messageId}: ${error.message}`);
                    }
                }
            }
            return { winners, message: msg };
        } finally {
            this._endingGiveaways.delete(String(messageId));
        }
    }

    async endChecker() {
        const now = utcEpoch();
        if (!fs.existsSync(DATA_DIR)) return;
        const files = await fsp.readdir(DATA_DIR);
        for (const fname of files) {
            if (!fname.endsWith('.json')) continue;
            const messageId = path.parse(fname).name;
            const data = await this.loadGiveaway(messageId);
            if (!data || data.status !== 'active') continue;
            const expire = Number(data.expire_epoch || 0);
            if (expire && expire <= now) {
                logger.info(`[Giveaway] Auto-ending giveaway ${messageId} (expired at ${expire})`);
                await this.endGiveaway(messageId);
            }
        }
    }
}

function setup(client) {
    const giveawayCog = new GiveawayCog(client);
    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...giveawayCog.commands);
    return giveawayCog;
}

module.exports = { setup, GiveawayCog };
