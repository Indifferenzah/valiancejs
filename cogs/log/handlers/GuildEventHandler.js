const { AuditLogEvent } = require('discord.js');
const AuditService = require('../services/AuditService');
const Formatters = require('../core/Formatters');
const logger = require('../../../utils/logger');

class GuildEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('guildUpdate', this.handleGuildUpdate.bind(this));
        this.client.on('roleCreate', this.handleRoleCreate.bind(this));
        this.client.on('roleDelete', this.handleRoleDelete.bind(this));
        this.client.on('webhookUpdate', this.handleWebhookUpdate.bind(this));
        this.client.on('inviteCreate', this.handleInviteCreate.bind(this));
        this.client.on('inviteDelete', this.handleInviteDelete.bind(this));
    }

    async handleGuildUpdate(oldGuild, newGuild) {
        try {
            const entry = await AuditService.getEntry(AuditLogEvent.GuildUpdate, newGuild.id, newGuild);
            const staffer = entry?.executor?.tag || 'Sistema';
            const changes = Formatters.formatAuditChanges(entry);

            const variables = {
                staffer,
                changes
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('guild_update'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log guild update: ${err.message}`);
        }
    }

    async handleRoleCreate(role) {
        try {
            const guild = role.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.RoleCreate, role.id, guild);

            const variables = {
                role: `<@&${role.id}>`,
                staffer,
                id: role.id
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('role_create'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log role create: ${err.message}`);
        }
    }

    async handleRoleDelete(role) {
        try {
            const guild = role.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.RoleDelete, role.id, guild);

            const variables = {
                name: role.name,
                staffer,
                id: role.id
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('role_delete'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log role delete: ${err.message}`);
        }
    }

    async handleWebhookUpdate(channel) {
        try {
            const guild = channel.guild;
            if (!guild) return;

            const logs = await guild.fetchAuditLogs({
                type: [
                    AuditLogEvent.WebhookCreate,
                    AuditLogEvent.WebhookDelete,
                    AuditLogEvent.WebhookUpdate
                ],
                limit: 5
            });

            const entry = logs.entries.first();
            if (!entry) return;

            const staffer = entry.executor?.tag || 'Sistema';
            const changes = Formatters.formatAuditChanges(entry);

            const baseVars = {
                staffer,
                id: entry.target?.id || 'N/A',
                name: entry.target?.name || 'N/A'
            };

            if (entry.action === AuditLogEvent.WebhookCreate) {
                await this.embedService.send(
                    this.config.getChannel('guildlog'),
                    this.config.getMessage('webhook_create'),
                    this.client,
                    null,
                    baseVars
                );
            } else if (entry.action === AuditLogEvent.WebhookDelete) {
                await this.embedService.send(
                    this.config.getChannel('guildlog'),
                    this.config.getMessage('webhook_delete'),
                    this.client,
                    null,
                    baseVars
                );
            } else if (entry.action === AuditLogEvent.WebhookUpdate) {
                await this.embedService.send(
                    this.config.getChannel('guildlog'),
                    this.config.getMessage('webhook_update'),
                    this.client,
                    null,
                    { ...baseVars, changes }
                );
            }
        } catch (err) {
            logger.error(`Errore log webhook update: ${err.message}`);
        }
    }

    async handleInviteCreate(invite) {
        try {
            const guild = invite.guild;
            if (!guild) return;

            const variables = {
                code: invite.code,
                channel: invite.channel?.toString() || 'N/A',
                inviter: invite.inviter?.tag || 'Sconosciuto',
                max_uses: invite.maxUses ?? 'Illimitato'
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
                channel: invite.channel?.toString() || 'N/A'
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
}

module.exports = GuildEventHandler;
