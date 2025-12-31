const path = require('path');
const logger = require('../../utils/logger');

const ConfigManager = require('./core/ConfigManager');
const EventRegistry = require('./core/EventRegistry');
const LoggerFactory = require('./core/LoggerFactory');

const { ChannelEventHandler, ThreadEventHandler, MemberEventHandler } = require('./handlers/EventHandlers');
const { MessageEventHandler, ModerationEventHandler, VoiceEventHandler } = require('./handlers/MessageModerationHandlers');
const { RoleEventHandler, EmojiEventHandler, StickerEventHandler, GuildEventHandler, InviteEventHandler, UserEventHandler } = require('./handlers/GuildHandlers');
const { AutoModEventHandler, StageEventHandler, WebhookEventHandler, InteractionEventHandler, PresenceEventHandler } = require('./handlers/SpecialHandlers');

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
    }

    async initialize() {
        try {
            logger.info('[LogCog] Initializing enterprise logging system...');

            await this.configManager.load();

            this.initializeHandlers();

            this.registerEventListeners();

            this.initialized = true;
            logger.info('[LogCog] Enterprise logging system initialized successfully');
            logger.info(`[LogCog] Registered ${EventRegistry.getAllEvents().length} loggable events`);

            return true;

        } catch (error) {
            logger.error('[LogCog] Error initializing logging system:', error);
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

        logger.info('[LogCog] Event handlers initialized');
    }

    registerEventListeners() {
        if (this.client.__logEventsRegistered) {
            logger.warn('[LogCog] Event listeners already registered, skipping...');
            return;
        }

        this.client.__logEventsRegistered = true;

        this.client.on('channelCreate', (channel) => this.safeHandle(() => this.handlers.channel.handleChannelCreate(channel)));
        this.client.on('channelDelete', (channel) => this.safeHandle(() => this.handlers.channel.handleChannelDelete(channel)));
        this.client.on('channelUpdate', (oldChannel, newChannel) => this.safeHandle(() => this.handlers.channel.handleChannelUpdate(oldChannel, newChannel)));
        this.client.on('channelPinsUpdate', (channel, time) => this.safeHandle(() => this.handlers.channel.handleChannelPinsUpdate(channel, time)));

        this.client.on('threadCreate', (thread, newlyCreated) => this.safeHandle(() => this.handlers.thread.handleThreadCreate(thread, newlyCreated)));
        this.client.on('threadDelete', (thread) => this.safeHandle(() => this.handlers.thread.handleThreadDelete(thread)));
        this.client.on('threadUpdate', (oldThread, newThread) => this.safeHandle(() => this.handlers.thread.handleThreadUpdate(oldThread, newThread)));
        this.client.on('threadMemberUpdate', (oldMember, newMember) => this.safeHandle(() => this.handlers.thread.handleThreadMemberUpdate(oldMember, newMember)));
        this.client.on('threadMembersUpdate', (addedMembers, removedMembers, thread) => this.safeHandle(() => this.handlers.thread.handleThreadMembersUpdate(addedMembers, removedMembers, thread)));

        this.client.on('guildMemberAdd', (member) => this.safeHandle(() => this.handlers.member.handleGuildMemberAdd(member)));
        this.client.on('guildMemberRemove', (member) => this.safeHandle(() => this.handlers.member.handleGuildMemberRemove(member)));
        this.client.on('guildMemberUpdate', (oldMember, newMember) => this.safeHandle(() => this.handlers.member.handleGuildMemberUpdate(oldMember, newMember)));

        this.client.on('messageDelete', (message) => this.safeHandle(() => this.handlers.message.handleMessageDelete(message)));
        this.client.on('messageUpdate', (oldMessage, newMessage) => this.safeHandle(() => this.handlers.message.handleMessageUpdate(oldMessage, newMessage)));
        this.client.on('messageDeleteBulk', (messages, channel) => this.safeHandle(() => this.handlers.message.handleMessageBulkDelete(messages, channel)));
        this.client.on('messageReactionAdd', (reaction, user) => this.safeHandle(() => this.handlers.message.handleMessageReactionAdd(reaction, user)));
        this.client.on('messageReactionRemove', (reaction, user) => this.safeHandle(() => this.handlers.message.handleMessageReactionRemove(reaction, user)));
        this.client.on('messageReactionRemoveAll', (message, reactions) => this.safeHandle(() => this.handlers.message.handleMessageReactionRemoveAll(message, reactions)));
        this.client.on('messageReactionRemoveEmoji', (reaction) => this.safeHandle(() => this.handlers.message.handleMessageReactionRemoveEmoji(reaction)));

        this.client.on('guildBanAdd', (ban) => this.safeHandle(() => this.handlers.moderation.handleGuildBanAdd(ban)));
        this.client.on('guildBanRemove', (ban) => this.safeHandle(() => this.handlers.moderation.handleGuildBanRemove(ban)));
        this.client.on('guildAuditLogEntryCreate', (auditLogEntry, guild) => this.safeHandle(() => this.handlers.moderation.handleGuildAuditLogEntryCreate(auditLogEntry, guild)));

        this.client.on('voiceStateUpdate', (oldState, newState) => this.safeHandle(() => this.handlers.voice.handleVoiceStateUpdate(oldState, newState)));

        this.client.on('roleCreate', (role) => this.safeHandle(() => this.handlers.role.handleRoleCreate(role)));
        this.client.on('roleDelete', (role) => this.safeHandle(() => this.handlers.role.handleRoleDelete(role)));
        this.client.on('roleUpdate', (oldRole, newRole) => this.safeHandle(() => this.handlers.role.handleRoleUpdate(oldRole, newRole)));

        this.client.on('emojiCreate', (emoji) => this.safeHandle(() => this.handlers.emoji.handleEmojiCreate(emoji)));
        this.client.on('emojiDelete', (emoji) => this.safeHandle(() => this.handlers.emoji.handleEmojiDelete(emoji)));
        this.client.on('emojiUpdate', (oldEmoji, newEmoji) => this.safeHandle(() => this.handlers.emoji.handleEmojiUpdate(oldEmoji, newEmoji)));

        this.client.on('stickerCreate', (sticker) => this.safeHandle(() => this.handlers.sticker.handleStickerCreate(sticker)));
        this.client.on('stickerDelete', (sticker) => this.safeHandle(() => this.handlers.sticker.handleStickerDelete(sticker)));
        this.client.on('stickerUpdate', (oldSticker, newSticker) => this.safeHandle(() => this.handlers.sticker.handleStickerUpdate(oldSticker, newSticker)));

        this.client.on('guildUpdate', (oldGuild, newGuild) => this.safeHandle(() => this.handlers.guild.handleGuildUpdate(oldGuild, newGuild)));
        this.client.on('guildScheduledEventCreate', (event) => this.safeHandle(() => this.handlers.guild.handleGuildScheduledEventCreate(event)));
        this.client.on('guildScheduledEventUpdate', (oldEvent, newEvent) => this.safeHandle(() => this.handlers.guild.handleGuildScheduledEventUpdate(oldEvent, newEvent)));
        this.client.on('guildScheduledEventDelete', (event) => this.safeHandle(() => this.handlers.guild.handleGuildScheduledEventDelete(event)));

        this.client.on('inviteCreate', (invite) => this.safeHandle(() => this.handlers.invite.handleInviteCreate(invite)));
        this.client.on('inviteDelete', (invite) => this.safeHandle(() => this.handlers.invite.handleInviteDelete(invite)));

        this.client.on('userUpdate', (oldUser, newUser) => this.safeHandle(() => this.handlers.user.handleUserUpdate(oldUser, newUser)));

        this.client.on('autoModerationRuleCreate', (rule) => this.safeHandle(() => this.handlers.automod.handleAutoModRuleCreate(rule)));
        this.client.on('autoModerationRuleUpdate', (oldRule, newRule) => this.safeHandle(() => this.handlers.automod.handleAutoModRuleUpdate(oldRule, newRule)));
        this.client.on('autoModerationRuleDelete', (rule) => this.safeHandle(() => this.handlers.automod.handleAutoModRuleDelete(rule)));
        this.client.on('autoModerationActionExecution', (execution) => this.safeHandle(() => this.handlers.automod.handleAutoModActionExecution(execution)));

        this.client.on('stageInstanceCreate', (stageInstance) => this.safeHandle(() => this.handlers.stage.handleStageInstanceCreate(stageInstance)));
        this.client.on('stageInstanceUpdate', (oldStage, newStage) => this.safeHandle(() => this.handlers.stage.handleStageInstanceUpdate(oldStage, newStage)));
        this.client.on('stageInstanceDelete', (stageInstance) => this.safeHandle(() => this.handlers.stage.handleStageInstanceDelete(stageInstance)));

        this.client.on('webhooksUpdate', (channel) => this.safeHandle(() => this.handlers.webhook.handleWebhooksUpdate(channel)));

        this.client.on('interactionCreate', (interaction) => this.safeHandle(() => this.handlers.interaction.handleInteractionCreate(interaction)));

        this.client.on('presenceUpdate', (oldPresence, newPresence) => this.safeHandle(() => this.handlers.presence.handlePresenceUpdate(oldPresence, newPresence)));

        logger.info('[LogCog] Event listeners registered');
    }

    async safeHandle(handlerFunction) {
        try {
            await handlerFunction();
        } catch (error) {
            logger.error('[LogCog] Error in event handler:', error);
        }
    }

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
        logger.info('[LogCog] Configuration reloaded');
    }

    async cleanup() {
        this.client.__logEventsRegistered = false;
        logger.info('[LogCog] Cleanup completed');
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
            initialized: this.initialized
        };
    }
}

module.exports = LogCog;
