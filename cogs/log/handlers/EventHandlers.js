const { AuditLogEvent } = require('discord.js');
const logger = require('../../../utils/logger');

class ChannelEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleChannelCreate(channel) {
        if (!channel.guild) return;

        const eventLogger = this.loggerFactory.getLogger('channelCreate');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);

        await eventLogger.log(channel.guild.id, {
            title: 'Canale Creato',
            description: `Il canale ${channel} è stato creato`,
            fields: [
                { name: 'Nome', value: channel.name, inline: true },
                { name: 'Tipo', value: this.getChannelType(channel.type), inline: true },
                { name: 'ID', value: channel.id, inline: true },
                { name: 'Categoria', value: channel.parent?.name || 'Nessuna', inline: true },
                { name: 'Creato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true },
                { name: 'Timestamp', value: eventLogger.formatTimestamp(channel.createdAt), inline: false }
            ]
        });
    }

    async handleChannelDelete(channel) {
        if (!channel.guild) return;

        const eventLogger = this.loggerFactory.getLogger('channelDelete');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);

        await eventLogger.log(channel.guild.id, {
            title: 'Canale Eliminato',
            description: `Il canale **${channel.name}** è stato eliminato`,
            fields: [
                { name: 'Nome', value: channel.name, inline: true },
                { name: 'Tipo', value: this.getChannelType(channel.type), inline: true },
                { name: 'ID', value: channel.id, inline: true },
                { name: 'Categoria', value: channel.parent?.name || 'Nessuna', inline: true },
                { name: 'Eliminato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true }
            ],
            color: '#F04747'
        });
    }

    async handleChannelUpdate(oldChannel, newChannel) {
        if (!newChannel.guild) return;

        const eventLogger = this.loggerFactory.getLogger('channelUpdate');
        if (!eventLogger) return;

        const changes = eventLogger.getDifferences(oldChannel, newChannel, [
            { key: 'name', name: 'Nome' },
            { key: 'topic', name: 'Descrizione' },
            { key: 'nsfw', name: 'NSFW' },
            { key: 'rateLimitPerUser', name: 'Slowmode' },
            { key: 'bitrate', name: 'Bitrate' },
            { key: 'userLimit', name: 'Limite Utenti' },
            { key: 'parent.name', name: 'Categoria' }
        ]);

        if (changes.length === 0) return;

        const executor = await eventLogger.getExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);

        await eventLogger.log(newChannel.guild.id, {
            title: 'Canale Aggiornato',
            description: `Il canale ${newChannel} è stato modificato`,
            fields: [
                { name: 'Canale', value: `${newChannel.name} (<#${newChannel.id}>)`, inline: true },
                { name: 'Modificato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                ...changes
            ]
        });
    }

    async handleChannelPinsUpdate(channel, time) {
        if (!channel.guild) return;

        const eventLogger = this.loggerFactory.getLogger('channelPinsUpdate');
        if (!eventLogger) return;

        await eventLogger.log(channel.guild.id, {
            title: 'Pin Aggiornati',
            description: `I messaggi pinnati in ${channel} sono stati modificati`,
            fields: [
                { name: 'Canale', value: `${channel.name} (<#${channel.id}>)`, inline: true },
                { name: 'Ultimo Pin', value: eventLogger.formatTimestamp(time), inline: true }
            ]
        });
    }

    getChannelType(type) {
        const types = {
            0: 'Testo',
            2: 'Vocale',
            4: 'Categoria',
            5: 'Annunci',
            10: 'Annunci Thread',
            11: 'Thread Pubblico',
            12: 'Thread Privato',
            13: 'Stage',
            15: 'Forum'
        };
        return types[type] || `Sconosciuto (${type})`;
    }
}

class ThreadEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleThreadCreate(thread, newlyCreated) {
        if (!thread.guild) return;

        const eventLogger = this.loggerFactory.getLogger('threadCreate');
        if (!eventLogger) return;

        await eventLogger.log(thread.guild.id, {
            title: 'Thread Creato',
            description: `È stato creato un nuovo thread: ${thread}`,
            fields: [
                { name: 'Nome', value: thread.name, inline: true },
                { name: 'ID', value: thread.id, inline: true },
                { name: 'Canale Padre', value: `<#${thread.parentId}>`, inline: true },
                { name: 'Creatore', value: thread.ownerId ? `<@${thread.ownerId}>` : 'Sconosciuto', inline: true },
                { name: 'Archiviato Auto', value: `${thread.autoArchiveDuration} minuti`, inline: true },
                { name: 'Nuovo', value: newlyCreated ? 'Sì' : 'No', inline: true }
            ]
        });
    }

    async handleThreadDelete(thread) {
        if (!thread.guild) return;

        const eventLogger = this.loggerFactory.getLogger('threadDelete');
        if (!eventLogger) return;

        await eventLogger.log(thread.guild.id, {
            title: 'Thread Eliminato',
            description: `Il thread **${thread.name}** è stato eliminato`,
            fields: [
                { name: 'Nome', value: thread.name, inline: true },
                { name: 'ID', value: thread.id, inline: true },
                { name: 'Canale Padre', value: `<#${thread.parentId}>`, inline: true }
            ],
            color: '#F04747'
        });
    }

    async handleThreadUpdate(oldThread, newThread) {
        if (!newThread.guild) return;

        const eventLogger = this.loggerFactory.getLogger('threadUpdate');
        if (!eventLogger) return;

        const changes = eventLogger.getDifferences(oldThread, newThread, [
            { key: 'name', name: 'Nome' },
            { key: 'archived', name: 'Archiviato' },
            { key: 'locked', name: 'Bloccato' },
            { key: 'autoArchiveDuration', name: 'Durata Auto-Archivio' }
        ]);

        if (changes.length === 0) return;

        await eventLogger.log(newThread.guild.id, {
            title: 'Thread Aggiornato',
            description: `Il thread ${newThread} è stato modificato`,
            fields: [
                { name: 'Thread', value: `${newThread.name} (<#${newThread.id}>)`, inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                ...changes
            ]
        });
    }

    async handleThreadMemberUpdate(oldMember, newMember) {
        if (!newMember.guildMember?.guild) return;

        const eventLogger = this.loggerFactory.getLogger('threadMemberUpdate');
        if (!eventLogger) return;

        await eventLogger.log(newMember.guildMember.guild.id, {
            title: 'Membro Thread Aggiornato',
            description: `Un membro del thread è stato aggiornato`,
            fields: [
                { name: 'Utente', value: `<@${newMember.userId}>`, inline: true },
                { name: 'Thread', value: `<#${newMember.id}>`, inline: true }
            ]
        });
    }

    async handleThreadMembersUpdate(addedMembers, removedMembers, thread) {
        if (!thread.guild) return;

        const eventLogger = this.loggerFactory.getLogger('threadMembersUpdate');
        if (!eventLogger) return;

        const fields = [
            { name: 'Thread', value: `${thread.name} (<#${thread.id}>)`, inline: false }
        ];

        if (addedMembers.size > 0) {
            fields.push({
                name: `Membri Aggiunti (${addedMembers.size})`,
                value: addedMembers.map(m => `<@${m.userId}>`).join(', '),
                inline: false
            });
        }

        if (removedMembers.size > 0) {
            fields.push({
                name: `Membri Rimossi (${removedMembers.size})`,
                value: removedMembers.map(m => `<@${m.userId}>`).join(', '),
                inline: false
            });
        }

        await eventLogger.log(thread.guild.id, {
            title: 'Membri Thread Aggiornati',
            fields
        });
    }
}

class MemberEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleGuildMemberAdd(member) {
        const eventLogger = this.loggerFactory.getLogger('guildMemberAdd');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(member.guild.id, member)) return;

        const accountAge = Date.now() - member.user.createdTimestamp;
        const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

        await eventLogger.log(member.guild.id, {
            title: 'Membro Entrato',
            description: `${member.user.tag} è entrato nel server`,
            thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
            fields: [
                { name: 'Utente', value: `${member.user.tag}`, inline: true },
                { name: 'ID', value: member.user.id, inline: true },
                { name: 'Bot', value: member.user.bot ? 'Sì' : 'No', inline: true },
                { name: 'Account Creato', value: eventLogger.formatTimestamp(member.user.createdAt), inline: false },
                { name: 'Età Account', value: `${accountAgeDays} giorni`, inline: true },
                { name: 'Membro #', value: member.guild.memberCount.toString(), inline: true }
            ],
            footer: { text: `ID: ${member.user.id}` }
        });
    }

    async handleGuildMemberRemove(member) {
        const eventLogger = this.loggerFactory.getLogger('guildMemberRemove');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(member.guild.id, member)) return;

        const roles = member.roles.cache
            .filter(role => role.id !== member.guild.id)
            .map(role => role.name)
            .join(', ') || 'Nessuno';

        await eventLogger.log(member.guild.id, {
            title: 'Membro Uscito',
            description: `${member.user.tag} ha lasciato il server`,
            thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
            fields: [
                { name: 'Utente', value: `${member.user.tag}`, inline: true },
                { name: 'ID', value: member.user.id, inline: true },
                { name: 'Ruoli', value: eventLogger.truncate(roles, 1024), inline: false },
                { name: 'Entrato il', value: eventLogger.formatTimestamp(member.joinedAt), inline: true },
                { name: 'Membri Rimasti', value: member.guild.memberCount.toString(), inline: true }
            ],
            footer: { text: `ID: ${member.user.id}` },
            color: '#F04747'
        });
    }

    async handleGuildMemberUpdate(oldMember, newMember) {
        const eventLogger = this.loggerFactory.getLogger('guildMemberUpdate');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(newMember.guild.id, newMember)) return;

        const changes = [];

        if (oldMember.nickname !== newMember.nickname) {
            changes.push({
                name: 'Nickname',
                value: `**Prima:** ${oldMember.nickname || 'Nessuno'}\n**Dopo:** ${newMember.nickname || 'Nessuno'}`,
                inline: false
            });
        }

        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        if (addedRoles.size > 0) {
            changes.push({
                name: 'Ruoli Aggiunti',
                value: addedRoles.map(role => `<@&${role.id}>`).join(', '),
                inline: false
            });
        }

        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
        if (removedRoles.size > 0) {
            changes.push({
                name: 'Ruoli Rimossi',
                value: removedRoles.map(role => `<@&${role.id}>`).join(', '),
                inline: false
            });
        }

        if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
            if (newMember.communicationDisabledUntil) {
                changes.push({
                    name: 'Timeout',
                    value: `Fino al ${eventLogger.formatTimestamp(newMember.communicationDisabledUntil)}`,
                    inline: false
                });
            } else {
                changes.push({
                    name: 'Timeout',
                    value: 'Rimosso',
                    inline: false
                });
            }
        }

        if (changes.length === 0) return;

        const executor = await eventLogger.getExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);

        await eventLogger.log(newMember.guild.id, {
            title: 'Membro Aggiornato',
            description: `${newMember.user.tag} è stato modificato`,
            thumbnail: newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
            fields: [
                { name: 'Utente', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: true },
                { name: 'Modificato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                ...changes
            ],
            footer: { text: `ID: ${newMember.id}` }
        });
    }
}

module.exports = {
    ChannelEventHandler,
    ThreadEventHandler,
    MemberEventHandler
};
