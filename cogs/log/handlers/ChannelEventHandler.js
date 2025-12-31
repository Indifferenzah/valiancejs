const { AuditLogEvent, PermissionsBitField } = require('discord.js');
const AuditService = require('../services/AuditService');
const Formatters = require('../core/Formatters');
const logger = require('../../../utils/logger');

class ChannelEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('channelUpdate', this.handleChannelUpdate.bind(this));
        this.client.on('channelUpdate', this.handlePermissionUpdate.bind(this));
    }

    async handleChannelUpdate(oldChannel, newChannel) {
        try {
            const guild = newChannel.guild;
            if (!guild) return;

            const entry = await AuditService.getEntry(AuditLogEvent.ChannelUpdate, newChannel.id, guild);
            if (!entry) return;

            const staffer = entry.executor?.tag || 'Sistema';
            const normalChanges = [];

            if (oldChannel.name !== newChannel.name) {
                normalChanges.push(`Nome: \`${oldChannel.name}\` → \`${newChannel.name}\``);
            }

            if (oldChannel.topic !== newChannel.topic) {
                normalChanges.push(`Topic: \`${oldChannel.topic || 'Nessuno'}\` → \`${newChannel.topic || 'Nessuno'}\``);
            }

            if (oldChannel.nsfw !== newChannel.nsfw) {
                normalChanges.push(`NSFW: \`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\``);
            }

            const oldSlow = oldChannel.rateLimitPerUser ?? 0;
            const newSlow = newChannel.rateLimitPerUser ?? 0;
            if (oldSlow !== newSlow) {
                normalChanges.push(`Slowmode: \`${oldSlow}s\` → \`${newSlow}s\``);
            }

            if (normalChanges.length === 0) return;

            const variables = {
                channel: newChannel.toString(),
                staffer,
                changes: normalChanges.join('\n'),
                slowmode: normalChanges.some(c => c.includes('Slowmode'))
                    ? `Slowmode: \`${oldSlow}s\` → \`${newSlow}s\``
                    : 'Nessuna modifica slowmode'
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('channel_update'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log channel update: ${err.message}`);
        }
    }

    async handlePermissionUpdate(oldChannel, newChannel) {
        try {
            const guild = newChannel.guild;
            if (!guild) return;

            const entry = await AuditService.getEntry(AuditLogEvent.PermissionOverwriteUpdate, newChannel.id, guild);
            if (!entry) return;

            const staffer = entry.executor?.tag || 'Sistema';
            let targetMention = 'Sconosciuto';

            const extra = entry.extra;
            if (extra && extra.id) {
                const t = extra.type;
                if (t === 0 || t === 'role') {
                    targetMention = `<@&${extra.id}>`;
                } else if (t === 1 || t === 'member') {
                    targetMention = `<@${extra.id}>`;
                }
            }

            const changesRaw = entry.changes || [];
            const added = [];
            const removed = [];

            for (const change of changesRaw) {
                if (change.key !== 'allow' && change.key !== 'deny') continue;

                const oldPerms = change.old ?? 0;
                const newPerms = change.new ?? 0;

                const oldList = new PermissionsBitField(BigInt(oldPerms)).toArray();
                const newList = new PermissionsBitField(BigInt(newPerms)).toArray();

                for (const perm of newList) {
                    if (!oldList.includes(perm)) added.push(perm);
                }
                for (const perm of oldList) {
                    if (!newList.includes(perm)) removed.push(perm);
                }
            }

            if (added.length === 0 && removed.length === 0) return;

            const variables = {
                channel: newChannel.toString(),
                staffer,
                target: targetMention,
                added_perms: added.length ? added.join(', ') : 'Nessuno',
                removed_perms: removed.length ? removed.join(', ') : 'Nessuno'
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('channel_permission_update'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore perm overwrite update: ${err.message}`);
        }
    }
}

module.exports = ChannelEventHandler;
