class ModerationLogger {
    constructor(config, embedService, client) {
        this.config = config;
        this.embedService = embedService;
        this.client = client;
    }

    async logBan(user, staffer, reason, origin = 'manual') {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            reason: reason || 'Nessuna ragione',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: origin,
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('ban'),
            this.client,
            user,
            variables
        );
    }

    async logBanAutomatic(user, guild, reason, trigger) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            staffer: 'Sistema',
            reason: reason || 'Nessuna ragione',
            trigger: trigger,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'auto',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('ban_automatic'),
            this.client,
            user,
            variables
        );
    }

    async logBanTemporary(user, staffer, reason, duration) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            reason: reason || 'Nessuna ragione',
            duration: duration,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('ban_temporary'),
            this.client,
            user,
            variables
        );
    }

    async logMassBan(staffer, guild, userCount, reason) {
        const variables = {
            staffer,
            guild_id: guild.id,
            user_count: String(userCount),
            reason: reason || 'Nessuna ragione',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('ban_mass'),
            this.client,
            null,
            variables
        );
    }

    async logBanFailed(user, staffer, reason, error) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            reason: reason || 'Nessuna ragione',
            error: error,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'fail'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('ban_failed'),
            this.client,
            user,
            variables
        );
    }

    async logUnbanAutomatic(user, guild, reason) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            staffer: 'Sistema',
            reason: reason || 'Scadenza tempban',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'auto',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('unban_automatic'),
            this.client,
            user,
            variables
        );
    }

    async logAuditSyncFailed(guild, error) {
        const variables = {
            guild_id: guild.id,
            error: error,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'sistema',
            outcome: 'fail'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('audit_sync_failed'),
            this.client,
            null,
            variables
        );
    }

    async logKick(user, staffer, reason, origin = 'manual') {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            reason: reason || 'Nessuna ragione',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: origin,
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('kick'),
            this.client,
            user,
            variables
        );
    }

    async logKickAutomatic(user, guild, reason) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            staffer: 'Sistema',
            reason: reason,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'auto',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('kick_automatic'),
            this.client,
            user,
            variables
        );
    }

    async logKickFailed(user, staffer, reason, error) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            reason: reason || 'Nessuna ragione',
            error: error,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'fail'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('kick_failed'),
            this.client,
            user,
            variables
        );
    }

    async logTimeout(user, staffer, reason, duration) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            reason: reason || 'Nessuna ragione',
            duration: duration,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('timeout'),
            this.client,
            user,
            variables
        );
    }

    async logTimeoutRemoved(user, staffer) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('timeout_removed'),
            this.client,
            user,
            variables
        );
    }

    async logTimeoutExtended(user, staffer, newDuration) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            new_duration: newDuration,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('timeout_extended'),
            this.client,
            user,
            variables
        );
    }

    async logTimeoutExpired(user, guild) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            staffer: 'Sistema',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'auto',
            outcome: 'expired'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('timeout_expired'),
            this.client,
            user,
            variables
        );
    }

    async logTimeoutError(user, staffer, error) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            error: error,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'fail'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('timeout_error'),
            this.client,
            user,
            variables
        );
    }

    async logMute(user, staffer, reason, duration) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            reason: reason || 'Nessuna ragione',
            duration: duration || 'Permanente',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('mute'),
            this.client,
            user,
            variables
        );
    }

    async logVoiceMute(user, staffer, channel) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            channel: channel.toString(),
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('voice_mute'),
            this.client,
            user,
            variables
        );
    }

    async logVoiceUnmute(user, staffer, channel) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            channel: channel.toString(),
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('voice_unmute'),
            this.client,
            user,
            variables
        );
    }

    async logUnmute(user, staffer) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('unmute'),
            this.client,
            user,
            variables
        );
    }

    async logWarn(user, staffer, reason, totalWarns) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            reason: reason || 'Nessuna ragione',
            total_warns: String(totalWarns ?? 0),
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('warn'),
            this.client,
            user,
            variables
        );
    }

    async logUnwarn(user, staffer, warnId) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            warn_id: String(warnId ?? 'N/A'),
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('unwarn'),
            this.client,
            user,
            variables
        );
    }

    async logWarnModified(user, staffer, warnId, oldReason, newReason) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            warn_id: String(warnId),
            old_reason: oldReason,
            new_reason: newReason,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('warn_modified'),
            this.client,
            user,
            variables
        );
    }

    async logClearWarns(user, staffer, count) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            count: String(count ?? 0),
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('clearwarns'),
            this.client,
            user,
            variables
        );
    }

    async logWarnThresholdAction(user, guild, warnCount, action) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            warn_count: String(warnCount),
            action: action,
            staffer: 'Sistema',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'auto',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('warn_threshold_action'),
            this.client,
            user,
            variables
        );
    }

    async logNick(user, staffer, newNick) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: user.guild?.id || 'N/A',
            staffer,
            new_nick: newNick,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('nick'),
            this.client,
            user,
            variables
        );
    }
}

module.exports = ModerationLogger;
