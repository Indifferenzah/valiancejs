const { AuditLogEvent } = require('discord.js');
const AuditService = require('../services/AuditService');
const logger = require('../../../utils/logger');

class ModerationEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('guildBanAdd', this.handleBanAdd.bind(this));
        this.client.on('guildBanRemove', this.handleBanRemove.bind(this));
    }

    async handleBanAdd(ban) {
        try {
            const staffer = await AuditService.getExecutor(AuditLogEvent.MemberBanAdd, ban.user.id, ban.guild);
            const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
            const entry = logs.entries.first();
            const reason = entry?.reason || 'Nessuna ragione';

            const variables = {
                mention: ban.user.toString(),
                id: ban.user.id,
                avatar: ban.user.displayAvatarURL(),
                staffer,
                reason
            };

            await this.embedService.send(
                this.config.getChannel('moderation'),
                this.config.getMessage('ban'),
                this.client,
                ban.user,
                variables
            );
        } catch (err) {
            logger.error(`Errore log ban: ${err.message}`);
        }
    }

    async handleBanRemove(ban) {
        try {
            const staffer = await AuditService.getExecutor(AuditLogEvent.MemberBanRemove, ban.user.id, ban.guild);

            const variables = {
                mention: ban.user.toString(),
                id: ban.user.id,
                avatar: ban.user.displayAvatarURL(),
                staffer
            };

            await this.embedService.send(
                this.config.getChannel('moderation'),
                this.config.getMessage('unban'),
                this.client,
                ban.user,
                variables
            );
        } catch (err) {
            logger.error(`Errore log unban: ${err.message}`);
        }
    }
}

module.exports = ModerationEventHandler;
