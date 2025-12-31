const { AuditLogEvent } = require('discord.js');
const AuditService = require('../services/AuditService');
const logger = require('../../../utils/logger');

class InviteEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('inviteCreate', this.handleInviteCreate.bind(this));
        this.client.on('inviteDelete', this.handleInviteDelete.bind(this));
    }

    async handleInviteCreate(invite) {
        try {
            const guild = invite.guild;
            if (!guild) return;

            const variables = {
                code: invite.code,
                guild_id: guild.id,
                channel: invite.channel?.toString() || 'N/A',
                inviter: invite.inviter?.tag || 'Sconosciuto',
                inviter_id: invite.inviter?.id || 'N/A',
                max_uses: String(invite.maxUses ?? 'Illimitato'),
                expires: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : 'Mai',
                timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                origin: 'user',
                outcome: 'success'
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('invite_create'),
                this.client,
                invite.inviter || null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log invite create: ${err.message}`);
        }
    }

    async handleInviteDelete(invite) {
        try {
            const guild = invite.guild;
            if (!guild) return;

            const variables = {
                code: invite.code,
                guild_id: guild.id,
                channel: invite.channel?.toString() || 'N/A',
                timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                origin: 'sistema',
                outcome: 'deleted'
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('invite_delete'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log invite delete: ${err.message}`);
        }
    }

    async logInviteUsed(invite, member) {
        try {
            const variables = {
                code: invite.code,
                guild_id: member.guild.id,
                inviter: invite.inviter?.tag || 'Sconosciuto',
                new_member: member.toString(),
                new_member_id: member.id,
                uses: String(invite.uses ?? 0),
                timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                origin: 'sistema',
                outcome: 'success'
            };

            await this.embedService.send(
                this.config.getChannel('join'),
                this.config.getMessage('invite_used'),
                this.client,
                member.user,
                variables
            );
        } catch (err) {
            logger.error(`Errore log invite used: ${err.message}`);
        }
    }
}

module.exports = InviteEventHandler;
