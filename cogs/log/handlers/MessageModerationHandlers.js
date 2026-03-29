const { AuditLogEvent } = require('discord.js');
const logger = require('../../../utils/logger');

class MessageEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleMessageDelete(message) {
        if (!message.guild) return;

        const eventLogger = this.loggerFactory.getLogger('messageDelete');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(message.guild.id, message)) return;
        if (this.configManager.shouldIgnore(message.guild.id, message.author)) return;

        const executor = await eventLogger.getExecutor(message.guild, AuditLogEvent.MessageDelete, message.author.id);

        await eventLogger.log(message.guild.id, {
            title: 'Messaggio Eliminato',
            description: `Un messaggio di ${message.author.tag} è stato eliminato in ${message.channel}`,
            fields: [
                { name: 'Autore', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
                { name: 'Canale', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Eliminato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true },
                { name: 'Contenuto', value: eventLogger.truncate(message.content || '*Nessun contenuto testuale*', 1024), inline: false },
                { name: 'Allegati', value: message.attachments.size > 0 ? `${message.attachments.size} file` : 'Nessuno', inline: true },
                { name: 'ID Messaggio', value: message.id, inline: true },
                { name: 'Creato il', value: eventLogger.formatTimestamp(message.createdAt), inline: true }
            ],
            thumbnail: message.author.displayAvatarURL({ dynamic: true }),
            footer: { text: `Autore ID: ${message.author.id}` },
            color: '#F04747'
        });
    }

    async handleMessageUpdate(oldMessage, newMessage) {
        if (!newMessage.guild) return;
        if (!oldMessage.content && !newMessage.content) return;
        if (oldMessage.content === newMessage.content) return;

        const eventLogger = this.loggerFactory.getLogger('messageUpdate');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(newMessage.guild.id, newMessage)) return;
        if (this.configManager.shouldIgnore(newMessage.guild.id, newMessage.author)) return;

        await eventLogger.log(newMessage.guild.id, {
            title: 'Messaggio Modificato',
            description: `Un messaggio di ${newMessage.author.tag} è stato modificato in ${newMessage.channel}`,
            fields: [
                { name: 'Autore', value: `${newMessage.author.tag} (<@${newMessage.author.id}>)`, inline: true },
                { name: 'Canale', value: `<#${newMessage.channel.id}>`, inline: true },
                { name: 'Link', value: `[Vai al messaggio](${newMessage.url})`, inline: true },
                { name: 'Prima', value: eventLogger.truncate(oldMessage.content || '*Nessun contenuto*', 1024), inline: false },
                { name: 'Dopo', value: eventLogger.truncate(newMessage.content || '*Nessun contenuto*', 1024), inline: false },
                { name: 'ID Messaggio', value: newMessage.id, inline: true }
            ],
            thumbnail: newMessage.author.displayAvatarURL({ dynamic: true }),
            footer: { text: `Autore ID: ${newMessage.author.id}` }
        });
    }

    async handleMessageBulkDelete(messages, channel) {
        if (!channel.guild) return;

        const eventLogger = this.loggerFactory.getLogger('messageDeleteBulk');
        if (!eventLogger) return;

        const messageList = Array.from(messages.values())
            .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
            .slice(0, 10)
            .map(msg => `**${msg.author?.tag || 'Unknown'}**: ${eventLogger.truncate(msg.content || '*Nessun contenuto*', 50)}`)
            .join('\n');

        await eventLogger.log(channel.guild.id, {
            title: 'Messaggi Eliminati in Bulk',
            description: `${messages.size} messaggi sono stati eliminati in ${channel}`,
            fields: [
                { name: 'Canale', value: `<#${channel.id}>`, inline: true },
                { name: 'Quantità', value: messages.size.toString(), inline: true },
                { name: 'Messaggi (primi 10)', value: messageList || 'Nessun messaggio disponibile', inline: false }
            ],
            color: '#F04747'
        });
    }

    async handleMessageReactionAdd(reaction, user) {
        if (!reaction.message.guild) return;

        const eventLogger = this.loggerFactory.getLogger('messageReactionAdd');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(reaction.message.guild.id, user)) return;

        const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

        await eventLogger.log(reaction.message.guild.id, {
            title: 'Reazione Aggiunta',
            description: `${user.tag} ha reagito con ${emoji}`,
            fields: [
                { name: 'Utente', value: `${user.tag} (<@${user.id}>)`, inline: true },
                { name: 'Emoji', value: emoji, inline: true },
                { name: 'Canale', value: `<#${reaction.message.channel.id}>`, inline: true },
                { name: 'Messaggio', value: `[Vai al messaggio](${reaction.message.url})`, inline: false }
            ],
            thumbnail: user.displayAvatarURL({ dynamic: true })
        });
    }

    async handleMessageReactionRemove(reaction, user) {
        if (!reaction.message.guild) return;

        const eventLogger = this.loggerFactory.getLogger('messageReactionRemove');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(reaction.message.guild.id, user)) return;

        const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

        await eventLogger.log(reaction.message.guild.id, {
            title: 'Reazione Rimossa',
            description: `${user.tag} ha rimosso la reazione ${emoji}`,
            fields: [
                { name: 'Utente', value: `${user.tag} (<@${user.id}>)`, inline: true },
                { name: 'Emoji', value: emoji, inline: true },
                { name: 'Canale', value: `<#${reaction.message.channel.id}>`, inline: true },
                { name: 'Messaggio', value: `[Vai al messaggio](${reaction.message.url})`, inline: false }
            ],
            thumbnail: user.displayAvatarURL({ dynamic: true }),
            color: '#F04747'
        });
    }

    async handleMessageReactionRemoveAll(message, reactions) {
        if (!message.guild) return;

        const eventLogger = this.loggerFactory.getLogger('messageReactionRemoveAll');
        if (!eventLogger) return;

        await eventLogger.log(message.guild.id, {
            title: 'Tutte le Reazioni Rimosse',
            description: `Tutte le reazioni sono state rimosse da un messaggio in ${message.channel}`,
            fields: [
                { name: 'Canale', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Messaggio', value: `[Vai al messaggio](${message.url})`, inline: true },
                { name: 'Reazioni Rimosse', value: reactions.size.toString(), inline: true }
            ],
            color: '#F04747'
        });
    }

    async handleMessageReactionRemoveEmoji(reaction) {
        if (!reaction.message.guild) return;

        const eventLogger = this.loggerFactory.getLogger('messageReactionRemoveEmoji');
        if (!eventLogger) return;

        const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

        await eventLogger.log(reaction.message.guild.id, {
            title: 'Emoji Rimosso',
            description: `Tutte le reazioni ${emoji} sono state rimosse`,
            fields: [
                { name: 'Emoji', value: emoji, inline: true },
                { name: 'Canale', value: `<#${reaction.message.channel.id}>`, inline: true },
                { name: 'Messaggio', value: `[Vai al messaggio](${reaction.message.url})`, inline: true }
            ],
            color: '#F04747'
        });
    }
}

class ModerationEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleGuildBanAdd(ban) {
        const eventLogger = this.loggerFactory.getLogger('guildBanAdd');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);

        await eventLogger.log(ban.guild.id, {
            title: 'Utente Bannato',
            description: `${ban.user.tag} è stato bannato dal server`,
            thumbnail: ban.user.displayAvatarURL({ dynamic: true, size: 256 }),
            fields: [
                { name: 'Utente', value: `${ban.user.tag} (<@${ban.user.id}>)`, inline: true },
                { name: 'ID', value: ban.user.id, inline: true },
                { name: 'Bannato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true },
                { name: 'Motivo', value: ban.reason || 'Nessun motivo specificato', inline: false }
            ],
            footer: { text: `ID: ${ban.user.id}` },
            color: '#F04747'
        });
    }

    async handleGuildBanRemove(ban) {
        const eventLogger = this.loggerFactory.getLogger('guildBanRemove');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);

        await eventLogger.log(ban.guild.id, {
            title: 'Utente Sbannato',
            description: `${ban.user.tag} è stato sbannato dal server`,
            thumbnail: ban.user.displayAvatarURL({ dynamic: true, size: 256 }),
            fields: [
                { name: 'Utente', value: `${ban.user.tag} (<@${ban.user.id}>)`, inline: true },
                { name: 'ID', value: ban.user.id, inline: true },
                { name: 'Sbannato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true }
            ],
            footer: { text: `ID: ${ban.user.id}` },
            color: '#43B581'
        });
    }

    async handleGuildAuditLogEntryCreate(auditLogEntry, guild) {
        const eventLogger = this.loggerFactory.getLogger('guildAuditLogEntryCreate');
        if (!eventLogger) return;

        await eventLogger.log(guild.id, {
            title: 'Audit Log Entry',
            description: `Nuova voce nell'audit log: ${this.getActionName(auditLogEntry.action)}`,
            fields: [
                { name: 'Azione', value: this.getActionName(auditLogEntry.action), inline: true },
                { name: 'Esecutore', value: auditLogEntry.executor ? `${auditLogEntry.executor.tag}` : 'Sconosciuto', inline: true },
                { name: 'Target', value: auditLogEntry.target ? `${auditLogEntry.targetId}` : 'Nessuno', inline: true },
                { name: 'Motivo', value: auditLogEntry.reason || 'Nessuno', inline: false }
            ]
        });
    }

    getActionName(action) {
        const actions = {
            1: 'Guild Update',
            10: 'Channel Create',
            11: 'Channel Update',
            12: 'Channel Delete',
            13: 'Channel Overwrite Create',
            14: 'Channel Overwrite Update',
            15: 'Channel Overwrite Delete',
            20: 'Member Kick',
            21: 'Member Prune',
            22: 'Member Ban Add',
            23: 'Member Ban Remove',
            24: 'Member Update',
            25: 'Member Role Update',
            26: 'Member Move',
            27: 'Member Disconnect',
            28: 'Bot Add',
            30: 'Role Create',
            31: 'Role Update',
            32: 'Role Delete',
            40: 'Invite Create',
            41: 'Invite Update',
            42: 'Invite Delete',
            50: 'Webhook Create',
            51: 'Webhook Update',
            52: 'Webhook Delete',
            60: 'Emoji Create',
            61: 'Emoji Update',
            62: 'Emoji Delete',
            72: 'Message Delete',
            73: 'Message Bulk Delete',
            74: 'Message Pin',
            75: 'Message Unpin',
            80: 'Integration Create',
            81: 'Integration Update',
            82: 'Integration Delete',
            83: 'Stage Instance Create',
            84: 'Stage Instance Update',
            85: 'Stage Instance Delete',
            90: 'Sticker Create',
            91: 'Sticker Update',
            92: 'Sticker Delete',
            100: 'Guild Scheduled Event Create',
            101: 'Guild Scheduled Event Update',
            102: 'Guild Scheduled Event Delete',
            110: 'Thread Create',
            111: 'Thread Update',
            112: 'Thread Delete',
            121: 'Auto Moderation Rule Create',
            122: 'Auto Moderation Rule Update',
            123: 'Auto Moderation Rule Delete',
            143: 'Auto Moderation Block Message',
            144: 'Auto Moderation Flag to Channel',
            145: 'Auto Moderation User Communication Disabled'
        };
        return actions[action] || `Unknown (${action})`;
    }
}

class VoiceEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleVoiceStateUpdate(oldState, newState) {
        if (!newState.guild) return;

        const eventLogger = this.loggerFactory.getLogger('voiceStateUpdate');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(newState.guild.id, newState.member)) return;

        const member = newState.member;
        let description = '';
        let color = '#FAA61A';

        // Join
        if (!oldState.channel && newState.channel) {
            description = `${member.user.tag} è entrato in ${newState.channel.name}`;
            color = '#43B581';
            this.handleVoiceChannelJoin(newState).catch(err => logger.error('[VoiceEventHandler] Join error:', err));
        }
        // Leave
        else if (oldState.channel && !newState.channel) {
            description = `${member.user.tag} è uscito da ${oldState.channel.name}`;
            color = '#F04747';
            this.handleVoiceChannelLeave(oldState).catch(err => logger.error('[VoiceEventHandler] Leave error:', err));
        }
        // Switch
        else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            description = `${member.user.tag} si è spostato da ${oldState.channel.name} a ${newState.channel.name}`;
            this.handleVoiceChannelSwitch(oldState, newState).catch(err => logger.error('[VoiceEventHandler] Switch error:', err));
        }
        // Other changes
        else {
            const changes = [];

            if (oldState.serverMute !== newState.serverMute || oldState.selfMute !== newState.selfMute) {
                if (oldState.serverMute !== newState.serverMute) {
                    changes.push(`${newState.serverMute ? 'Mutato dal server' : 'Smutato dal server'}`);
                }
                if (oldState.selfMute !== newState.selfMute) {
                    changes.push(`${newState.selfMute ? 'Auto-mutato' : 'Auto-smutato'}`);
                }
                this.handleVoiceChannelMute(oldState, newState).catch(err => logger.error('[VoiceEventHandler] Mute error:', err));
            }

            if (oldState.serverDeaf !== newState.serverDeaf || oldState.selfDeaf !== newState.selfDeaf) {
                if (oldState.serverDeaf !== newState.serverDeaf) {
                    changes.push(`${newState.serverDeaf ? 'Deafenato dal server' : 'Undeafenato dal server'}`);
                }
                if (oldState.selfDeaf !== newState.selfDeaf) {
                    changes.push(`${newState.selfDeaf ? 'Auto-deafenato' : 'Auto-undeafenato'}`);
                }
                this.handleVoiceChannelDeaf(oldState, newState).catch(err => logger.error('[VoiceEventHandler] Deaf error:', err));
            }

            if (oldState.streaming !== newState.streaming) {
                changes.push(`${newState.streaming ? 'Streaming iniziato' : 'Streaming terminato'}`);
                if (newState.streaming) {
                    this.handleVoiceStreamingStart(newState).catch(err => logger.error('[VoiceEventHandler] Streaming start error:', err));
                } else {
                    this.handleVoiceStreamingStop(oldState).catch(err => logger.error('[VoiceEventHandler] Streaming stop error:', err));
                }
            }

            if (oldState.selfVideo !== newState.selfVideo) {
                changes.push(`${newState.selfVideo ? 'Video acceso' : 'Video spento'}`);
            }

            if (changes.length === 0) return;

            description = `${member.user.tag}: ${changes.join(', ')}`;
        }

        await eventLogger.log(newState.guild.id, {
            title: 'Stato Voice Aggiornato',
            description,
            fields: [
                { name: 'Utente', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                { name: 'Canale', value: newState.channel ? `<#${newState.channel.id}>` : 'Nessuno', inline: true }
            ],
            thumbnail: member.user.displayAvatarURL({ dynamic: true }),
            color
        });
    }

    async handleVoiceChannelJoin(state) {
        const eventLogger = this.loggerFactory.getLogger('voiceChannelJoin');
        if (!eventLogger) return;

        const member = state.member;

        await eventLogger.log(state.guild.id, {
            title: 'Entrato in Canale Vocale',
            description: `${member.user.tag} è entrato in un canale vocale`,
            fields: [
                { name: 'Utente', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                { name: 'Canale', value: `${state.channel.name} (<#${state.channel.id}>)`, inline: true }
            ],
            thumbnail: member.user.displayAvatarURL({ dynamic: true }),
            color: '#43B581'
        });
    }

    async handleVoiceChannelLeave(state) {
        const eventLogger = this.loggerFactory.getLogger('voiceChannelLeave');
        if (!eventLogger) return;

        const member = state.member;

        await eventLogger.log(state.guild.id, {
            title: 'Uscito da Canale Vocale',
            description: `${member.user.tag} è uscito da un canale vocale`,
            fields: [
                { name: 'Utente', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                { name: 'Canale', value: `${state.channel.name} (<#${state.channel.id}>)`, inline: true }
            ],
            thumbnail: member.user.displayAvatarURL({ dynamic: true }),
            color: '#F04747'
        });
    }

    async handleVoiceChannelSwitch(oldState, newState) {
        const eventLogger = this.loggerFactory.getLogger('voiceChannelSwitch');
        if (!eventLogger) return;

        const member = newState.member;

        await eventLogger.log(newState.guild.id, {
            title: 'Cambio Canale Vocale',
            description: `${member.user.tag} si è spostato tra canali vocali`,
            fields: [
                { name: 'Utente', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
                { name: 'Da', value: `${oldState.channel.name} (<#${oldState.channel.id}>)`, inline: true },
                { name: 'A', value: `${newState.channel.name} (<#${newState.channel.id}>)`, inline: true }
            ],
            thumbnail: member.user.displayAvatarURL({ dynamic: true }),
            color: '#FAA61A'
        });
    }

    async handleVoiceChannelMute(oldState, newState) {
        const eventLogger = this.loggerFactory.getLogger('voiceChannelMute');
        if (!eventLogger) return;

        const member = newState.member;
        const isMuted = newState.serverMute || newState.selfMute;
        const muteType = newState.serverMute ? 'server' : 'utente';

        await eventLogger.log(newState.guild.id, {
            title: isMuted ? 'Utente Mutato' : 'Utente Smutato',
            description: `${member.user.tag} è stato ${isMuted ? 'mutato' : 'smutato'}`,
            fields: [
                { name: 'Utente', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                { name: 'Canale', value: newState.channel ? `<#${newState.channel.id}>` : 'Nessuno', inline: true },
                { name: 'Tipo', value: muteType === 'server' ? 'Dal server' : 'Auto-mute', inline: true }
            ],
            thumbnail: member.user.displayAvatarURL({ dynamic: true }),
            color: isMuted ? '#F04747' : '#43B581'
        });
    }

    async handleVoiceChannelDeaf(oldState, newState) {
        const eventLogger = this.loggerFactory.getLogger('voiceChannelDeaf');
        if (!eventLogger) return;

        const member = newState.member;
        const isDeaf = newState.serverDeaf || newState.selfDeaf;
        const deafType = newState.serverDeaf ? 'server' : 'utente';

        await eventLogger.log(newState.guild.id, {
            title: isDeaf ? 'Utente Deafenato' : 'Utente Undeafenato',
            description: `${member.user.tag} è stato ${isDeaf ? 'deafenato' : 'undeafenato'}`,
            fields: [
                { name: 'Utente', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                { name: 'Canale', value: newState.channel ? `<#${newState.channel.id}>` : 'Nessuno', inline: true },
                { name: 'Tipo', value: deafType === 'server' ? 'Dal server' : 'Auto-deaf', inline: true }
            ],
            thumbnail: member.user.displayAvatarURL({ dynamic: true }),
            color: isDeaf ? '#F04747' : '#43B581'
        });
    }

    async handleVoiceStreamingStart(state) {
        const eventLogger = this.loggerFactory.getLogger('voiceStreamingStart');
        if (!eventLogger) return;

        const member = state.member;

        await eventLogger.log(state.guild.id, {
            title: 'Streaming Iniziato',
            description: `${member.user.tag} ha iniziato a streammare`,
            fields: [
                { name: 'Utente', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                { name: 'Canale', value: state.channel ? `<#${state.channel.id}>` : 'Nessuno', inline: true }
            ],
            thumbnail: member.user.displayAvatarURL({ dynamic: true }),
            color: '#9B59B6'
        });
    }

    async handleVoiceStreamingStop(state) {
        const eventLogger = this.loggerFactory.getLogger('voiceStreamingStop');
        if (!eventLogger) return;

        const member = state.member;

        await eventLogger.log(state.guild.id, {
            title: 'Streaming Terminato',
            description: `${member.user.tag} ha terminato lo streaming`,
            fields: [
                { name: 'Utente', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                { name: 'Canale', value: state.channel ? `<#${state.channel.id}>` : 'Nessuno', inline: true }
            ],
            thumbnail: member.user.displayAvatarURL({ dynamic: true }),
            color: '#95A5A6'
        });
    }
}

module.exports = {
    MessageEventHandler,
    ModerationEventHandler,
    VoiceEventHandler
};
