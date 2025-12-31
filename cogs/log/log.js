const path = require('path');
const logger = require('../../utils/logger');

const ConfigManager = require('./core/ConfigManager');
const WebhookService = require('./services/WebhookService');
const EmbedService = require('./services/EmbedService');

const MemberEventHandler = require('./handlers/MemberEventHandler');
const ModerationEventHandler = require('./handlers/ModerationEventHandler');
const MemberUpdateEventHandler = require('./handlers/MemberUpdateEventHandler');
const VoiceEventHandler = require('./handlers/VoiceEventHandler');
const MessageEventHandler = require('./handlers/MessageEventHandler');
const ReactionEventHandler = require('./handlers/ReactionEventHandler');
const ChannelEventHandler = require('./handlers/ChannelEventHandler');
const ThreadEventHandler = require('./handlers/ThreadEventHandler');
const GuildEventHandler = require('./handlers/GuildEventHandler');
const EmojiEventHandler = require('./handlers/EmojiEventHandler');
const StickerEventHandler = require('./handlers/StickerEventHandler');
const UserEventHandler = require('./handlers/UserEventHandler');

const ModerationLogger = require('./loggers/ModerationLogger');
const TicketLogger = require('./loggers/TicketLogger');
const AutoroleLogger = require('./loggers/AutoroleLogger');
const AutomodLogger = require('./loggers/AutomodLogger');
const SecurityLogger = require('./loggers/SecurityLogger');
const CommandLogger = require('./loggers/CommandLogger');

class LogCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'log.json');
        
        this.config = new ConfigManager(this.configPath);
        this.webhookService = new WebhookService();
        this.embedService = new EmbedService(this.webhookService);

        this.moderationLogger = new ModerationLogger(this.config, this.embedService, this.client);
        this.ticketLogger = new TicketLogger(this.config, this.embedService, this.client);
        this.autoroleLogger = new AutoroleLogger(this.config, this.embedService, this.client);
        this.automodLogger = new AutomodLogger(this.config, this.embedService, this.client);
        this.securityLogger = new SecurityLogger(this.config, this.embedService, this.client);
        this.commandLogger = new CommandLogger(this.config, this.embedService, this.client);

        if (!this.client.__logHandlersRegistered) {
            this.client.__logHandlersRegistered = true;
            this.registerEventHandlers();
        }
    }

    registerEventHandlers() {
        const handlers = [
            new MemberEventHandler(this.client, this.config, this.embedService),
            new ModerationEventHandler(this.client, this.config, this.embedService),
            new MemberUpdateEventHandler(this.client, this.config, this.embedService),
            new VoiceEventHandler(this.client, this.config, this.embedService),
            new MessageEventHandler(this.client, this.config, this.embedService),
            new ReactionEventHandler(this.client, this.config, this.embedService),
            new ChannelEventHandler(this.client, this.config, this.embedService),
            new ThreadEventHandler(this.client, this.config, this.embedService),
            new GuildEventHandler(this.client, this.config, this.embedService),
            new EmojiEventHandler(this.client, this.config, this.embedService),
            new StickerEventHandler(this.client, this.config, this.embedService),
            new UserEventHandler(this.client, this.config, this.embedService)
        ];

        handlers.forEach(handler => handler.register());
        logger.info('Log handlers registrati con successo');
    }

    reloadConfig() {
        this.config.reload();
        logger.info('Log config ricaricata');
    }

    async logBan(user, staffer, reason) {
        await this.moderationLogger.logBan(user, staffer, reason);
    }

    async logKick(user, staffer, reason) {
        await this.moderationLogger.logKick(user, staffer, reason);
    }

    async logMute(user, staffer, reason, duration) {
        await this.moderationLogger.logMute(user, staffer, reason, duration);
    }

    async logUnmute(user, staffer) {
        await this.moderationLogger.logUnmute(user, staffer);
    }

    async logWarn(user, staffer, reason, totalWarns) {
        await this.moderationLogger.logWarn(user, staffer, reason, totalWarns);
    }

    async logUnwarn(user, staffer, warnId) {
        await this.moderationLogger.logUnwarn(user, staffer, warnId);
    }

    async logClearWarns(user, staffer, count) {
        await this.moderationLogger.logClearWarns(user, staffer, count);
    }

    async logNick(user, staffer, newNick) {
        await this.moderationLogger.logNick(user, staffer, newNick);
    }

    async logTicketOpen(user, channel, number, category) {
        await this.ticketLogger.logTicketOpen(user, channel, number, category);
    }

    async logTicketClose(channel, opener, staffer, number) {
        await this.ticketLogger.logTicketClose(channel, opener, staffer, number);
    }

    async logTicketRename(channel, newName, staffer, number) {
        await this.ticketLogger.logTicketRename(channel, newName, staffer, number);
    }

    async logTicketAdd(member, channel, staffer, number) {
        await this.ticketLogger.logTicketAdd(member, channel, staffer, number);
    }

    async logTicketRemove(member, channel, staffer, number) {
        await this.ticketLogger.logTicketRemove(member, channel, staffer, number);
    }

    async logAutoroleAdd(user, role) {
        await this.autoroleLogger.logAutoroleAdd(user, role);
    }

    async logAutoroleRemove(user, role) {
        await this.autoroleLogger.logAutoroleRemove(user, role);
    }

    async logAutomodMute(user, reason, duration) {
        await this.automodLogger.logAutomodMute(user, reason, duration);
    }

    async logAutomodWarn(user, word) {
        await this.automodLogger.logAutomodWarn(user, word);
    }

    async logBanAutomatic(user, guild, reason, trigger) {
        await this.moderationLogger.logBanAutomatic(user, guild, reason, trigger);
    }

    async logBanTemporary(user, staffer, reason, duration) {
        await this.moderationLogger.logBanTemporary(user, staffer, reason, duration);
    }

    async logMassBan(staffer, guild, userCount, reason) {
        await this.moderationLogger.logMassBan(staffer, guild, userCount, reason);
    }

    async logBanFailed(user, staffer, reason, error) {
        await this.moderationLogger.logBanFailed(user, staffer, reason, error);
    }

    async logUnbanAutomatic(user, guild, reason) {
        await this.moderationLogger.logUnbanAutomatic(user, guild, reason);
    }

    async logKickAutomatic(user, guild, reason) {
        await this.moderationLogger.logKickAutomatic(user, guild, reason);
    }

    async logKickFailed(user, staffer, reason, error) {
        await this.moderationLogger.logKickFailed(user, staffer, reason, error);
    }

    async logTimeout(user, staffer, reason, duration) {
        await this.moderationLogger.logTimeout(user, staffer, reason, duration);
    }

    async logTimeoutRemoved(user, staffer) {
        await this.moderationLogger.logTimeoutRemoved(user, staffer);
    }

    async logTimeoutExtended(user, staffer, newDuration) {
        await this.moderationLogger.logTimeoutExtended(user, staffer, newDuration);
    }

    async logTimeoutExpired(user, guild) {
        await this.moderationLogger.logTimeoutExpired(user, guild);
    }

    async logVoiceMute(user, staffer, channel) {
        await this.moderationLogger.logVoiceMute(user, staffer, channel);
    }

    async logVoiceUnmute(user, staffer, channel) {
        await this.moderationLogger.logVoiceUnmute(user, staffer, channel);
    }

    async logWarnModified(user, staffer, warnId, oldReason, newReason) {
        await this.moderationLogger.logWarnModified(user, staffer, warnId, oldReason, newReason);
    }

    async logWarnThresholdAction(user, guild, warnCount, action) {
        await this.moderationLogger.logWarnThresholdAction(user, guild, warnCount, action);
    }

    async logExploitAttempt(user, guild, exploitType, details) {
        await this.securityLogger.logExploitAttempt(user, guild, exploitType, details);
    }

    async logCommandSpam(user, guild, commandCount, timeframe) {
        await this.securityLogger.logCommandSpam(user, guild, commandCount, timeframe);
    }

    async logMessageFlood(user, guild, messageCount, timeframe) {
        await this.securityLogger.logMessageFlood(user, guild, messageCount, timeframe);
    }

    async logRapidNicknameChange(user, guild, changeCount, oldNick, newNick) {
        await this.securityLogger.logRapidNicknameChange(user, guild, changeCount, oldNick, newNick);
    }

    async logSuspiciousAvatarChange(user, guild, reason) {
        await this.securityLogger.logSuspiciousAvatarChange(user, guild, reason);
    }

    async logBypassAttempt(user, guild, bypassType, details) {
        await this.securityLogger.logBypassAttempt(user, guild, bypassType, details);
    }

    async logRateLimit(user, guild, endpoint, retryAfter) {
        await this.securityLogger.logRateLimit(user, guild, endpoint, retryAfter);
    }

    async logSuspiciousInvite(invite, guild, reason) {
        await this.securityLogger.logSuspiciousInvite(invite, guild, reason);
    }

    async logCommandExecuted(user, guild, commandName, channel, args) {
        await this.commandLogger.logCommandExecuted(user, guild, commandName, channel, args);
    }

    async logCommandFailed(user, guild, commandName, error, channel) {
        await this.commandLogger.logCommandFailed(user, guild, commandName, error, channel);
    }

    async logCommandNoPermission(user, guild, commandName, requiredPermission, channel) {
        await this.commandLogger.logCommandNoPermission(user, guild, commandName, requiredPermission, channel);
    }

    async logCommandCooldown(user, guild, commandName, remainingTime, channel) {
        await this.commandLogger.logCommandCooldown(user, guild, commandName, remainingTime, channel);
    }

    async logCommandByBot(botUser, guild, commandName, channel) {
        await this.commandLogger.logCommandByBot(botUser, guild, commandName, channel);
    }

    async logInvalidParameters(user, guild, commandName, invalidParams, channel) {
        await this.commandLogger.logInvalidParameters(user, guild, commandName, invalidParams, channel);
    }
}

function setup(client) {
    const cog = new LogCog(client);
    client.logCog = cog;
    return cog;
}

module.exports = { setup, LogCog };
