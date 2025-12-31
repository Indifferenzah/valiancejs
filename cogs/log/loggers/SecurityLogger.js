const logger = require('../../../utils/logger');

class SecurityLogger {
    constructor(config, embedService, client) {
        this.config = config;
        this.embedService = embedService;
        this.client = client;
    }

    async logExploitAttempt(user, guild, exploitType, details) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            exploit_type: exploitType,
            details: details || 'Nessun dettaglio',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'sistema',
            outcome: 'blocked'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('exploit_attempt'),
            this.client,
            user,
            variables
        );
    }

    async logCommandSpam(user, guild, commandCount, timeframe) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            command_count: String(commandCount),
            timeframe: timeframe,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'anti-spam',
            outcome: 'blocked'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('command_spam'),
            this.client,
            user,
            variables
        );
    }

    async logMessageFlood(user, guild, messageCount, timeframe) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            message_count: String(messageCount),
            timeframe: timeframe,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'anti-flood',
            outcome: 'blocked'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('message_flood'),
            this.client,
            user,
            variables
        );
    }

    async logRapidNicknameChange(user, guild, changeCount, oldNick, newNick) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            change_count: String(changeCount),
            old_nick: oldNick || 'Nessuno',
            new_nick: newNick || 'Nessuno',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'sistema',
            outcome: 'flagged'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('rapid_nickname_change'),
            this.client,
            user,
            variables
        );
    }

    async logSuspiciousAvatarChange(user, guild, reason) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            reason: reason || 'Sospetto',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'AI',
            outcome: 'flagged'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('suspicious_avatar_change'),
            this.client,
            user,
            variables
        );
    }

    async logBypassAttempt(user, guild, bypassType, details) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            bypass_type: bypassType,
            details: details || 'Nessun dettaglio',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'sistema',
            outcome: 'blocked'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('bypass_attempt'),
            this.client,
            user,
            variables
        );
    }

    async logRateLimit(user, guild, endpoint, retryAfter) {
        const variables = {
            mention: user?.toString() || 'Sistema',
            id: user?.id || 'N/A',
            avatar: user?.displayAvatarURL() || '',
            guild_id: guild.id,
            endpoint: endpoint,
            retry_after: String(retryAfter),
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'Discord API',
            outcome: 'rate_limited'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('rate_limit'),
            this.client,
            user,
            variables
        );
    }

    async logSuspiciousInvite(invite, guild, reason) {
        const variables = {
            code: invite.code,
            inviter: invite.inviter?.tag || 'Sconosciuto',
            guild_id: guild.id,
            reason: reason,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'anti-raid',
            outcome: 'flagged'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('suspicious_invite'),
            this.client,
            invite.inviter,
            variables
        );
    }
}

module.exports = SecurityLogger;
