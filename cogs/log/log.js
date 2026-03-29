'use strict';

const path = require('path');
const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

const ConfigManager = require('./core/ConfigManager');
const EventRegistry = require('./core/EventRegistry');
const LoggerFactory = require('./core/LoggerFactory');

const { ChannelEventHandler, ThreadEventHandler, MemberEventHandler } = require('./handlers/EventHandlers');
const { MessageEventHandler, ModerationEventHandler, VoiceEventHandler } = require('./handlers/MessageModerationHandlers');
const { RoleEventHandler, EmojiEventHandler, StickerEventHandler, GuildEventHandler, InviteEventHandler, UserEventHandler } = require('./handlers/GuildHandlers');
const { AutoModEventHandler, StageEventHandler, WebhookEventHandler, InteractionEventHandler, PresenceEventHandler } = require('./handlers/SpecialHandlers');

// Features
const db = require('./db/logDatabase');
const antiSnipe = require('./features/antiSnipe');
const voiceTracker = require('./features/voiceTracker');
const watchlist = require('./features/watchlist');
const historyTracker = require('./features/historyTracker');
const dailyDigest = require('./features/dailyDigest');
const imageRecovery = require('./features/imageRecovery');
const duplicateDetector = require('./features/duplicateDetector');
const botMonitor = require('./features/botMonitor');
const raidDetector = require('./features/raidDetector');

// Slash commands
const slashCommands = require('./commands');

// Config del progetto per staff role
let projectConfig = {};
try {
    projectConfig = require('../../config.json');
} catch { /* ignora */ }

const STAFF_ROLE_ID = projectConfig?.moderation?.staff_role_id || projectConfig?.ticket_staff_role_id || null;

class LogCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'log.json');

        this.configManager = new ConfigManager(this.configPath);
        this.loggerFactory = new LoggerFactory(this.client, this.configManager);

        this.handlers = {
            channel: null,
            thread: null,
            member: null,
            message: null,
            moderation: null,
            voice: null,
            role: null,
            emoji: null,
            sticker: null,
            guild: null,
            invite: null,
            user: null,
            automod: null,
            stage: null,
            webhook: null,
            interaction: null,
            presence: null
        };

        this.initialized = false;
        this._digestIntervals = [];
    }

    async initialize() {
        try {
            logger.info('[LogCog] Inizializzazione sistema di logging avanzato...');

            // Inizializza database
            await db.init();
            logger.info('[LogCog] Database SQLite inizializzato');

            // Carica configurazione
            await this.configManager.load();

            // Inizializza handlers
            this.initializeHandlers();

            // Registra event listeners
            this.registerEventListeners();

            // Registra comandi slash
            this.registerSlashCommands();

            // Pulizia periodica
            this.startPeriodicCleanup();

            // Pianifica daily digest per ogni guild configurata
            this.scheduleDailyDigests();

            this.initialized = true;
            logger.info('[LogCog] Sistema di logging avanzato inizializzato correttamente');
            logger.info(`[LogCog] Registrati ${EventRegistry.getAllEvents().length} eventi loggabili`);

            return true;
        } catch (error) {
            logger.error('[LogCog] Errore durante l\'inizializzazione:', error);
            return false;
        }
    }

    initializeHandlers() {
        this.handlers.channel = new ChannelEventHandler(this.loggerFactory, this.configManager);
        this.handlers.thread = new ThreadEventHandler(this.loggerFactory, this.configManager);
        this.handlers.member = new MemberEventHandler(this.loggerFactory, this.configManager);
        this.handlers.message = new MessageEventHandler(this.loggerFactory, this.configManager);
        this.handlers.moderation = new ModerationEventHandler(this.loggerFactory, this.configManager);
        this.handlers.voice = new VoiceEventHandler(this.loggerFactory, this.configManager);
        this.handlers.role = new RoleEventHandler(this.loggerFactory, this.configManager);
        this.handlers.emoji = new EmojiEventHandler(this.loggerFactory, this.configManager);
        this.handlers.sticker = new StickerEventHandler(this.loggerFactory, this.configManager);
        this.handlers.guild = new GuildEventHandler(this.loggerFactory, this.configManager);
        this.handlers.invite = new InviteEventHandler(this.loggerFactory, this.configManager);
        this.handlers.user = new UserEventHandler(this.loggerFactory, this.configManager);
        this.handlers.automod = new AutoModEventHandler(this.loggerFactory, this.configManager);
        this.handlers.stage = new StageEventHandler(this.loggerFactory, this.configManager);
        this.handlers.webhook = new WebhookEventHandler(this.loggerFactory, this.configManager);
        this.handlers.interaction = new InteractionEventHandler(this.loggerFactory, this.configManager);
        this.handlers.presence = new PresenceEventHandler(this.loggerFactory, this.configManager);

        logger.info('[LogCog] Handlers degli eventi inizializzati');
    }

    registerEventListeners() {
        if (this.client.__logEventsRegistered) {
            logger.warn('[LogCog] Event listeners già registrati, skip...');
            return;
        }

        this.client.__logEventsRegistered = true;

        // Channel events
        this.client.on('channelCreate', (c) => this.safeHandle(() => this.handlers.channel.handleChannelCreate(c)));
        this.client.on('channelDelete', (c) => this.safeHandle(() => this.handlers.channel.handleChannelDelete(c)));
        this.client.on('channelUpdate', (o, n) => this.safeHandle(() => this.handlers.channel.handleChannelUpdate(o, n)));
        this.client.on('channelPinsUpdate', (c, t) => this.safeHandle(() => this.handlers.channel.handleChannelPinsUpdate(c, t)));

        // Thread events
        this.client.on('threadCreate', (t, n) => this.safeHandle(() => this.handlers.thread.handleThreadCreate(t, n)));
        this.client.on('threadDelete', (t) => this.safeHandle(() => this.handlers.thread.handleThreadDelete(t)));
        this.client.on('threadUpdate', (o, n) => this.safeHandle(() => this.handlers.thread.handleThreadUpdate(o, n)));
        this.client.on('threadMemberUpdate', (o, n) => this.safeHandle(() => this.handlers.thread.handleThreadMemberUpdate(o, n)));
        this.client.on('threadMembersUpdate', (a, r, t) => this.safeHandle(() => this.handlers.thread.handleThreadMembersUpdate(a, r, t)));

        // Member events
        this.client.on('guildMemberAdd', (m) => this.safeHandle(() => this.handlers.member.handleGuildMemberAdd(m)));
        this.client.on('guildMemberRemove', (m) => this.safeHandle(() => this.handlers.member.handleGuildMemberRemove(m)));
        this.client.on('guildMemberUpdate', (o, n) => this.safeHandle(() => this.handlers.member.handleGuildMemberUpdate(o, n)));

        // Message events — messageCreate gestito separatamente per caching/duplicate detection
        this.client.on('messageCreate', (m) => this.safeHandle(() => this.handlers.message.handleMessageCreate(m)));
        this.client.on('messageDelete', (m) => this.safeHandle(() => this.handlers.message.handleMessageDelete(m)));
        this.client.on('messageUpdate', (o, n) => this.safeHandle(() => this.handlers.message.handleMessageUpdate(o, n)));
        this.client.on('messageDeleteBulk', (msgs, ch) => this.safeHandle(() => this.handlers.message.handleMessageBulkDelete(msgs, ch)));
        this.client.on('messageReactionAdd', (r, u) => this.safeHandle(() => this.handlers.message.handleMessageReactionAdd(r, u)));
        this.client.on('messageReactionRemove', (r, u) => this.safeHandle(() => this.handlers.message.handleMessageReactionRemove(r, u)));
        this.client.on('messageReactionRemoveAll', (msg, r) => this.safeHandle(() => this.handlers.message.handleMessageReactionRemoveAll(msg, r)));
        this.client.on('messageReactionRemoveEmoji', (r) => this.safeHandle(() => this.handlers.message.handleMessageReactionRemoveEmoji(r)));

        // Moderation events
        this.client.on('guildBanAdd', (b) => this.safeHandle(() => this.handlers.moderation.handleGuildBanAdd(b)));
        this.client.on('guildBanRemove', (b) => this.safeHandle(() => this.handlers.moderation.handleGuildBanRemove(b)));
        this.client.on('guildAuditLogEntryCreate', (e, g) => this.safeHandle(() => this.handlers.moderation.handleGuildAuditLogEntryCreate(e, g)));

        // Voice events
        this.client.on('voiceStateUpdate', (o, n) => this.safeHandle(() => this.handlers.voice.handleVoiceStateUpdate(o, n)));

        // Role events
        this.client.on('roleCreate', (r) => this.safeHandle(() => this.handlers.role.handleRoleCreate(r)));
        this.client.on('roleDelete', (r) => this.safeHandle(() => this.handlers.role.handleRoleDelete(r)));
        this.client.on('roleUpdate', (o, n) => this.safeHandle(() => this.handlers.role.handleRoleUpdate(o, n)));

        // Emoji events
        this.client.on('emojiCreate', (e) => this.safeHandle(() => this.handlers.emoji.handleEmojiCreate(e)));
        this.client.on('emojiDelete', (e) => this.safeHandle(() => this.handlers.emoji.handleEmojiDelete(e)));
        this.client.on('emojiUpdate', (o, n) => this.safeHandle(() => this.handlers.emoji.handleEmojiUpdate(o, n)));

        // Sticker events
        this.client.on('stickerCreate', (s) => this.safeHandle(() => this.handlers.sticker.handleStickerCreate(s)));
        this.client.on('stickerDelete', (s) => this.safeHandle(() => this.handlers.sticker.handleStickerDelete(s)));
        this.client.on('stickerUpdate', (o, n) => this.safeHandle(() => this.handlers.sticker.handleStickerUpdate(o, n)));

        // Guild events
        this.client.on('guildUpdate', (o, n) => this.safeHandle(() => this.handlers.guild.handleGuildUpdate(o, n)));
        this.client.on('guildScheduledEventCreate', (e) => this.safeHandle(() => this.handlers.guild.handleGuildScheduledEventCreate(e)));
        this.client.on('guildScheduledEventUpdate', (o, n) => this.safeHandle(() => this.handlers.guild.handleGuildScheduledEventUpdate(o, n)));
        this.client.on('guildScheduledEventDelete', (e) => this.safeHandle(() => this.handlers.guild.handleGuildScheduledEventDelete(e)));

        // Invite events
        this.client.on('inviteCreate', (i) => this.safeHandle(() => this.handlers.invite.handleInviteCreate(i)));
        this.client.on('inviteDelete', (i) => this.safeHandle(() => this.handlers.invite.handleInviteDelete(i)));

        // User events
        this.client.on('userUpdate', (o, n) => this.safeHandle(() => this.handlers.user.handleUserUpdate(o, n)));

        // AutoMod events
        this.client.on('autoModerationRuleCreate', (r) => this.safeHandle(() => this.handlers.automod.handleAutoModRuleCreate(r)));
        this.client.on('autoModerationRuleUpdate', (o, n) => this.safeHandle(() => this.handlers.automod.handleAutoModRuleUpdate(o, n)));
        this.client.on('autoModerationRuleDelete', (r) => this.safeHandle(() => this.handlers.automod.handleAutoModRuleDelete(r)));
        this.client.on('autoModerationActionExecution', (e) => this.safeHandle(() => this.handlers.automod.handleAutoModActionExecution(e)));

        // Stage events
        this.client.on('stageInstanceCreate', (s) => this.safeHandle(() => this.handlers.stage.handleStageInstanceCreate(s)));
        this.client.on('stageInstanceUpdate', (o, n) => this.safeHandle(() => this.handlers.stage.handleStageInstanceUpdate(o, n)));
        this.client.on('stageInstanceDelete', (s) => this.safeHandle(() => this.handlers.stage.handleStageInstanceDelete(s)));

        // Webhook events
        this.client.on('webhooksUpdate', (c) => this.safeHandle(() => this.handlers.webhook.handleWebhooksUpdate(c)));

        // Interaction events — gestisce sia i comandi slash del log sia gli altri
        this.client.on('interactionCreate', (i) => this.safeHandle(() => this.handleInteraction(i)));

        // Presence events
        this.client.on('presenceUpdate', (o, n) => this.safeHandle(() => this.handlers.presence.handlePresenceUpdate(o, n)));

        // Bot ready — invia notifica startup
        this.client.once('ready', () => {
            const monitorChannelId = this.getMonitorChannelId();
            if (monitorChannelId) {
                botMonitor.logBotReady(this.client, monitorChannelId).catch(() => {});
            }
        });

        logger.info('[LogCog] Event listeners registrati');
    }

    /**
     * Gestisce le interactions: prima i comandi del log, poi delega all'handler originale
     */
    async handleInteraction(interaction) {
        if (!interaction.guild) return;

        // Gestisci comandi slash del sistema di log
        if (interaction.isChatInputCommand()) {
            const handled = await this.handleLogCommand(interaction);
            if (handled) return;
        }

        // Delega all'handler originale (per logging dell'interazione)
        await this.handlers.interaction.handleInteractionCreate(interaction);
    }

    /**
     * Gestisce i comandi slash del sistema di log
     * @returns {boolean} true se il comando è stato gestito
     */
    async handleLogCommand(interaction) {
        const { commandName } = interaction;

        try {
            switch (commandName) {
                case 'snipe':
                    await this.handleSnipeCommand(interaction);
                    return true;

                case 'editsnipe':
                    await this.handleEditSnipeCommand(interaction);
                    return true;

                case 'voicestats':
                    await this.handleVoiceStatsCommand(interaction);
                    return true;

                case 'voiceleaderboard':
                    await this.handleVoiceLeaderboardCommand(interaction);
                    return true;

                case 'watchlist':
                    await this.handleWatchlistCommand(interaction);
                    return true;

                case 'history':
                    await this.handleHistoryCommand(interaction);
                    return true;

                default:
                    return false;
            }
        } catch (err) {
            logger.error(`[LogCog] Errore nel comando /${commandName}:`, err);
            try {
                const reply = { content: '❌ Si è verificato un errore durante l\'esecuzione del comando.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            } catch { /* ignora */ }
            return true;
        }
    }

    async handleSnipeCommand(interaction) {
        await interaction.deferReply();

        const snipe = await antiSnipe.getSnipe(interaction.channel.id);
        if (!snipe) {
            return interaction.editReply({ content: '❌ Nessun messaggio eliminato trovato in questo canale.' });
        }

        const embed = new EmbedBuilder()
            .setColor('#F04747')
            .setTitle('🗑️ Ultimo Messaggio Eliminato')
            .setDescription(snipe.content ? `\`\`\`\n${snipe.content.substring(0, 4080)}\n\`\`\`` : '*Nessun contenuto testuale*')
            .addFields(
                { name: 'Autore', value: `${snipe.author_tag} (<@${snipe.author_id}>)`, inline: true },
                { name: 'Canale', value: `<#${snipe.channel_id}>`, inline: true },
                { name: 'Eliminato', value: `<t:${Math.floor(snipe.deleted_at / 1000)}:R>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Anti-Snipe | Valiance' });

        // Allegati in cache
        if (snipe.attachments) {
            try {
                const attachments = JSON.parse(snipe.attachments);
                if (attachments.length > 0) {
                    embed.addFields({
                        name: `📎 Allegati (${attachments.length})`,
                        value: attachments.map(url => `[File](${url})`).join(', '),
                        inline: false
                    });
                }
            } catch { /* ignora */ }
        }

        await interaction.editReply({ embeds: [embed] });
    }

    async handleEditSnipeCommand(interaction) {
        await interaction.deferReply();

        const snipe = await antiSnipe.getEditSnipe(interaction.channel.id);
        if (!snipe) {
            return interaction.editReply({ content: '❌ Nessun messaggio modificato trovato in questo canale.' });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('✏️ Ultimo Messaggio Modificato')
            .addFields(
                { name: 'Autore', value: `${snipe.author_tag} (<@${snipe.author_id}>)`, inline: true },
                { name: 'Canale', value: `<#${snipe.channel_id}>`, inline: true },
                { name: 'Modificato', value: `<t:${Math.floor(snipe.edited_at / 1000)}:R>`, inline: true },
                { name: 'Prima', value: snipe.old_content ? `\`\`\`\n${snipe.old_content.substring(0, 1010)}\n\`\`\`` : '*nessun contenuto*', inline: false },
                { name: 'Dopo', value: snipe.new_content ? `\`\`\`\n${snipe.new_content.substring(0, 1010)}\n\`\`\`` : '*nessun contenuto*', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Edit-Snipe | Valiance' });

        await interaction.editReply({ embeds: [embed] });
    }

    async handleVoiceStatsCommand(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('utente') || interaction.user;
        const days = interaction.options.getInteger('giorni') || 7;

        const stats = await voiceTracker.getUserStats(interaction.guild.id, targetUser.id, days);

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle(`🎤 Statistiche Vocali — ${targetUser.tag}`)
            .setDescription(`Statistiche degli ultimi **${days} giorni**`)
            .addFields(
                { name: 'Tempo Totale', value: stats.totalFormatted, inline: true },
                { name: 'Sessioni', value: stats.sessionCount.toString(), inline: true },
                { name: 'Periodo', value: `Ultimi ${days} giorni`, inline: true }
            )
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp()
            .setFooter({ text: 'Voice Tracker | Valiance' });

        await interaction.editReply({ embeds: [embed] });
    }

    async handleVoiceLeaderboardCommand(interaction) {
        await interaction.deferReply();

        const leaderboard = await voiceTracker.getLeaderboard(interaction.guild.id, 7, 10);

        if (!leaderboard || leaderboard.length === 0) {
            return interaction.editReply({ content: '❌ Nessun dato vocale disponibile per questa settimana.' });
        }

        const rows = leaderboard.map((entry, i) =>
            `**#${i + 1}** <@${entry.user_id}> — \`${entry.totalFormatted}\` (${entry.sessions} sessioni)`
        ).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🏆 Classifica Vocale — Ultima Settimana')
            .setDescription(rows)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setTimestamp()
            .setFooter({ text: 'Voice Tracker | Valiance' });

        await interaction.editReply({ embeds: [embed] });
    }

    async handleWatchlistCommand(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // Solo staff può gestire la watchlist
        if (!this.isStaff(interaction.member)) {
            return interaction.reply({
                content: '❌ Non hai i permessi per usare questo comando.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: subcommand !== 'list' });

        switch (subcommand) {
            case 'add': {
                const user = interaction.options.getUser('utente');
                const reason = interaction.options.getString('motivo') || null;
                const success = await watchlist.addToWatchlist(
                    interaction.guild.id, user.id,
                    interaction.user.tag, reason
                );
                if (success) {
                    await interaction.editReply({ content: `✅ **${user.tag}** aggiunto alla watchlist${reason ? ` per: *${reason}*` : ''}.` });
                } else {
                    await interaction.editReply({ content: '❌ Errore durante l\'aggiunta alla watchlist.' });
                }
                break;
            }

            case 'remove': {
                const user = interaction.options.getUser('utente');
                const success = await watchlist.removeFromWatchlist(interaction.guild.id, user.id);
                if (success) {
                    await interaction.editReply({ content: `✅ **${user.tag}** rimosso dalla watchlist.` });
                } else {
                    await interaction.editReply({ content: `❌ **${user.tag}** non è nella watchlist.` });
                }
                break;
            }

            case 'list': {
                const list = await watchlist.getWatchlist(interaction.guild.id);
                if (!list || list.length === 0) {
                    return interaction.editReply({ content: '📋 La watchlist è vuota.' });
                }

                const rows = list.map((entry, i) =>
                    `**${i + 1}.** <@${entry.user_id}> — ${entry.reason || 'Nessun motivo'} *(aggiunto da ${entry.added_by || 'N/A'})*`
                ).join('\n');

                const embed = new EmbedBuilder()
                    .setColor('#FF6B35')
                    .setTitle(`🔍 Watchlist — ${interaction.guild.name}`)
                    .setDescription(rows.substring(0, 4096))
                    .setTimestamp()
                    .setFooter({ text: `${list.length} utenti monitorati` });

                await interaction.editReply({ embeds: [embed] });
                break;
            }
        }
    }

    async handleHistoryCommand(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('utente');
        const entries = await historyTracker.getHistory(targetUser.id, 10);
        const fields = historyTracker.formatHistory(entries);

        const embed = new EmbedBuilder()
            .setColor('#FAA61A')
            .setTitle(`📜 Cronologia — ${targetUser.tag}`)
            .setDescription(`Ultimi ${Math.min(entries.length, 10)} cambiamenti registrati`)
            .addFields(fields)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp()
            .setFooter({ text: `ID: ${targetUser.id}` });

        await interaction.editReply({ embeds: [embed] });
    }

    /**
     * Registra i comandi slash globalmente
     */
    registerSlashCommands() {
        if (!this.client.globalCommands) {
            this.client.globalCommands = [];
        }

        for (const cmd of slashCommands) {
            // Controlla se il comando è già registrato
            const exists = this.client.globalCommands.find(c => c.name === cmd.name);
            if (!exists) {
                this.client.globalCommands.push(cmd.toJSON());
            }
        }

        logger.info(`[LogCog] ${slashCommands.length} comandi slash registrati`);
    }

    /**
     * Pianifica il daily digest per tutte le guild configurate
     */
    scheduleDailyDigests() {
        const config = this.configManager.config;
        if (!config || !config.guilds) return;

        for (const [guildId, guildConfig] of Object.entries(config.guilds)) {
            // Usa il canale di log generico o quello dei messaggi come canale per il digest
            const digestChannelId = guildConfig.channels?.digest ||
                this.configManager.getEventChannel(guildId, 'guildMemberAdd');

            if (digestChannelId) {
                const interval = dailyDigest.scheduleDailyDigest(this.client, guildId, digestChannelId);
                this._digestIntervals.push(interval);
            }
        }
    }

    /**
     * Pulizia periodica dei dati
     */
    startPeriodicCleanup() {
        // Ogni 30 minuti
        const cleanupInterval = setInterval(async () => {
            try {
                await imageRecovery.cleanOldCache();
                await duplicateDetector.cleanOldEntries();
                await raidDetector.cleanOldEntries();
            } catch (err) {
                logger.error('[LogCog] Errore nella pulizia periodica:', err);
            }
        }, 30 * 60 * 1000);

        cleanupInterval.unref();
        this._cleanupInterval = cleanupInterval;
    }

    /**
     * Ottieni il canale di monitoring del bot
     */
    getMonitorChannelId() {
        const config = this.configManager.config;
        if (!config || !config.guilds) return null;

        for (const [guildId, guildConfig] of Object.entries(config.guilds)) {
            if (guildConfig.channels?.botMonitor) {
                return guildConfig.channels.botMonitor;
            }
        }
        return null;
    }

    /**
     * Verifica se un membro è staff
     */
    isStaff(member) {
        if (!member) return false;
        if (member.permissions.has('Administrator')) return true;
        if (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID)) return true;
        return false;
    }

    async safeHandle(handlerFunction) {
        try {
            await handlerFunction();
        } catch (error) {
            logger.error('[LogCog] Errore nell\'handler evento:', error);
        }
    }

    // ── Metodi pubblici per gestione configurazione ──────────────────────────

    async enableEvent(guildId, eventName, channelId) {
        return await this.configManager.enableEvent(guildId, eventName, channelId);
    }

    async disableEvent(guildId, eventName) {
        return await this.configManager.disableEvent(guildId, eventName);
    }

    getGuildConfig(guildId) {
        return this.configManager.getGuildConfig(guildId);
    }

    async updateGuildConfig(guildId, updates) {
        return await this.configManager.updateGuildConfig(guildId, updates);
    }

    getAvailableEvents() {
        return EventRegistry.getAllEvents();
    }

    getEventsByCategory(category) {
        return EventRegistry.getEventsByCategory(category);
    }

    getCategories() {
        return EventRegistry.getCategoryNames();
    }

    async reload() {
        await this.configManager.load();
        this.loggerFactory.reload();
        logger.info('[LogCog] Configurazione ricaricata');
    }

    async cleanup() {
        this.client.__logEventsRegistered = false;
        if (this._cleanupInterval) clearInterval(this._cleanupInterval);
        for (const interval of this._digestIntervals) clearInterval(interval);
        await db.close().catch(() => {});
        logger.info('[LogCog] Cleanup completato');
    }

    getStats() {
        const allEvents = EventRegistry.getAllEvents();
        const categories = EventRegistry.getCategoryNames();

        return {
            totalEvents: allEvents.length,
            totalCategories: categories.length,
            categories: categories.map(cat => ({
                name: cat,
                eventCount: EventRegistry.getEventsByCategory(cat).length
            })),
            initialized: this.initialized,
            dbReady: db.ready
        };
    }
}

module.exports = LogCog;

module.exports.setup = async (client) => {
    const logCog = new LogCog(client);
    await logCog.initialize();
    return logCog;
};
