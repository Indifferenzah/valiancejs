'use strict';

const { AuditLogEvent } = require('discord.js');
const logger = require('../../../utils/logger');

// Feature imports
const historyTracker = require('../features/historyTracker');
const watchlist = require('../features/watchlist');
const dailyDigest = require('../features/dailyDigest');

class RoleEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleRoleCreate(role) {
        const eventLogger = this.loggerFactory.getLogger('roleCreate');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);

        await eventLogger.log(role.guild.id, {
            title: 'Ruolo Creato',
            description: `Il ruolo <@&${role.id}> è stato creato`,
            fields: [
                { name: 'Nome', value: role.name, inline: true },
                { name: 'ID', value: role.id, inline: true },
                { name: 'Colore', value: role.hexColor, inline: true },
                { name: 'Hoisted', value: role.hoist ? 'Sì' : 'No', inline: true },
                { name: 'Mentionable', value: role.mentionable ? 'Sì' : 'No', inline: true },
                { name: 'Posizione', value: role.position.toString(), inline: true },
                { name: 'Creato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: false }
            ],
            color: role.hexColor || '#43B581'
        });
    }

    async handleRoleDelete(role) {
        const eventLogger = this.loggerFactory.getLogger('roleDelete');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);

        await eventLogger.log(role.guild.id, {
            title: 'Ruolo Eliminato',
            description: `Il ruolo **${role.name}** è stato eliminato`,
            fields: [
                { name: 'Nome', value: role.name, inline: true },
                { name: 'ID', value: role.id, inline: true },
                { name: 'Colore', value: role.hexColor, inline: true },
                { name: 'Membri', value: role.members.size.toString(), inline: true },
                { name: 'Eliminato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true }
            ],
            color: '#F04747'
        });
    }

    async handleRoleUpdate(oldRole, newRole) {
        const eventLogger = this.loggerFactory.getLogger('roleUpdate');
        if (!eventLogger) return;

        const changes = eventLogger.getDifferences(oldRole, newRole, [
            { key: 'name', name: 'Nome' },
            { key: 'hexColor', name: 'Colore' },
            { key: 'hoist', name: 'Hoisted' },
            { key: 'mentionable', name: 'Mentionable' },
            { key: 'position', name: 'Posizione' }
        ]);

        const addedPerms = newRole.permissions.toArray().filter(p => !oldRole.permissions.toArray().includes(p));
        const removedPerms = oldRole.permissions.toArray().filter(p => !newRole.permissions.toArray().includes(p));

        if (addedPerms.length > 0) {
            changes.push({
                name: 'Permessi Aggiunti',
                value: addedPerms.join(', '),
                inline: false
            });
        }

        if (removedPerms.length > 0) {
            changes.push({
                name: 'Permessi Rimossi',
                value: removedPerms.join(', '),
                inline: false
            });
        }

        if (changes.length === 0) return;

        const executor = await eventLogger.getExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

        await eventLogger.log(newRole.guild.id, {
            title: 'Ruolo Aggiornato',
            description: `Il ruolo <@&${newRole.id}> è stato modificato`,
            fields: [
                { name: 'Ruolo', value: `${newRole.name} (<@&${newRole.id}>)`, inline: true },
                { name: 'Modificato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                ...changes
            ],
            color: newRole.hexColor || '#FAA61A'
        });
    }
}

class EmojiEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleEmojiCreate(emoji) {
        const eventLogger = this.loggerFactory.getLogger('emojiCreate');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);

        await eventLogger.log(emoji.guild.id, {
            title: 'Emoji Creato',
            description: `L'emoji ${emoji} è stato creato`,
            thumbnail: emoji.url,
            fields: [
                { name: 'Nome', value: emoji.name, inline: true },
                { name: 'ID', value: emoji.id, inline: true },
                { name: 'Animato', value: emoji.animated ? 'Sì' : 'No', inline: true },
                { name: 'Creato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true },
                { name: 'URL', value: `[Clicca qui](${emoji.url})`, inline: false }
            ],
            color: '#43B581'
        });
    }

    async handleEmojiDelete(emoji) {
        const eventLogger = this.loggerFactory.getLogger('emojiDelete');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);

        await eventLogger.log(emoji.guild.id, {
            title: 'Emoji Eliminato',
            description: `L'emoji **:${emoji.name}:** è stato eliminato`,
            thumbnail: emoji.url,
            fields: [
                { name: 'Nome', value: emoji.name, inline: true },
                { name: 'ID', value: emoji.id, inline: true },
                { name: 'Animato', value: emoji.animated ? 'Sì' : 'No', inline: true },
                { name: 'Eliminato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true }
            ],
            color: '#F04747'
        });
    }

    async handleEmojiUpdate(oldEmoji, newEmoji) {
        const eventLogger = this.loggerFactory.getLogger('emojiUpdate');
        if (!eventLogger) return;

        const changes = eventLogger.getDifferences(oldEmoji, newEmoji, [
            { key: 'name', name: 'Nome' }
        ]);

        if (changes.length === 0) return;

        const executor = await eventLogger.getExecutor(newEmoji.guild, AuditLogEvent.EmojiUpdate, newEmoji.id);

        await eventLogger.log(newEmoji.guild.id, {
            title: 'Emoji Aggiornato',
            description: `L'emoji ${newEmoji} è stato modificato`,
            thumbnail: newEmoji.url,
            fields: [
                { name: 'Emoji', value: `${newEmoji}`, inline: true },
                { name: 'Modificato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                ...changes
            ],
            color: '#FAA61A'
        });
    }
}

class StickerEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleStickerCreate(sticker) {
        const eventLogger = this.loggerFactory.getLogger('stickerCreate');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);

        await eventLogger.log(sticker.guild.id, {
            title: 'Sticker Creato',
            description: `Lo sticker **${sticker.name}** è stato creato`,
            thumbnail: sticker.url,
            fields: [
                { name: 'Nome', value: sticker.name, inline: true },
                { name: 'ID', value: sticker.id, inline: true },
                { name: 'Descrizione', value: sticker.description || 'Nessuna', inline: false },
                { name: 'Tags', value: sticker.tags || 'Nessuno', inline: true },
                { name: 'Creato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true }
            ],
            color: '#43B581'
        });
    }

    async handleStickerDelete(sticker) {
        const eventLogger = this.loggerFactory.getLogger('stickerDelete');
        if (!eventLogger) return;

        const executor = await eventLogger.getExecutor(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);

        await eventLogger.log(sticker.guild.id, {
            title: 'Sticker Eliminato',
            description: `Lo sticker **${sticker.name}** è stato eliminato`,
            fields: [
                { name: 'Nome', value: sticker.name, inline: true },
                { name: 'ID', value: sticker.id, inline: true },
                { name: 'Eliminato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true }
            ],
            color: '#F04747'
        });
    }

    async handleStickerUpdate(oldSticker, newSticker) {
        const eventLogger = this.loggerFactory.getLogger('stickerUpdate');
        if (!eventLogger) return;

        const changes = eventLogger.getDifferences(oldSticker, newSticker, [
            { key: 'name', name: 'Nome' },
            { key: 'description', name: 'Descrizione' },
            { key: 'tags', name: 'Tags' }
        ]);

        if (changes.length === 0) return;

        const executor = await eventLogger.getExecutor(newSticker.guild, AuditLogEvent.StickerUpdate, newSticker.id);

        await eventLogger.log(newSticker.guild.id, {
            title: 'Sticker Aggiornato',
            description: `Lo sticker **${newSticker.name}** è stato modificato`,
            thumbnail: newSticker.url,
            fields: [
                { name: 'Sticker', value: newSticker.name, inline: true },
                { name: 'Modificato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                ...changes
            ],
            color: '#FAA61A'
        });
    }
}

class GuildEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleGuildUpdate(oldGuild, newGuild) {
        const eventLogger = this.loggerFactory.getLogger('guildUpdate');
        if (!eventLogger) return;

        const changes = eventLogger.getDifferences(oldGuild, newGuild, [
            { key: 'name', name: 'Nome' },
            { key: 'description', name: 'Descrizione' },
            { key: 'afkChannelId', name: 'Canale AFK' },
            { key: 'afkTimeout', name: 'Timeout AFK' },
            { key: 'systemChannelId', name: 'Canale Sistema' },
            { key: 'rulesChannelId', name: 'Canale Regole' },
            { key: 'publicUpdatesChannelId', name: 'Canale Aggiornamenti' },
            { key: 'preferredLocale', name: 'Lingua' },
            { key: 'explicitContentFilter', name: 'Filtro Contenuti' },
            { key: 'verificationLevel', name: 'Livello Verifica' },
            { key: 'defaultMessageNotifications', name: 'Notifiche Default' },
            { key: 'premiumTier', name: 'Boost Tier' },
            { key: 'premiumSubscriptionCount', name: 'Boost Count' }
        ]);

        if (oldGuild.iconURL() !== newGuild.iconURL()) {
            changes.push({ name: 'Icona', value: 'Modificata', inline: true });
        }
        if (oldGuild.bannerURL() !== newGuild.bannerURL()) {
            changes.push({ name: 'Banner', value: 'Modificato', inline: true });
        }
        if (oldGuild.splashURL() !== newGuild.splashURL()) {
            changes.push({ name: 'Splash', value: 'Modificato', inline: true });
        }

        if (changes.length === 0) return;

        const executor = await eventLogger.getExecutor(newGuild, AuditLogEvent.GuildUpdate, newGuild.id);

        await eventLogger.log(newGuild.id, {
            title: 'Server Aggiornato',
            description: `Il server **${newGuild.name}** è stato modificato`,
            thumbnail: newGuild.iconURL({ dynamic: true, size: 256 }),
            fields: [
                { name: 'Modificato da', value: executor ? `${executor.tag}` : 'Sconosciuto', inline: false },
                ...changes
            ],
            color: '#FAA61A'
        });
    }

    async handleGuildScheduledEventCreate(event) {
        const eventLogger = this.loggerFactory.getLogger('guildScheduledEventCreate');
        if (!eventLogger) return;

        await eventLogger.log(event.guild.id, {
            title: 'Evento Programmato Creato',
            description: `L'evento **${event.name}** è stato creato`,
            fields: [
                { name: 'Nome', value: event.name, inline: true },
                { name: 'ID', value: event.id, inline: true },
                { name: 'Inizio', value: eventLogger.formatTimestamp(event.scheduledStartAt), inline: true },
                { name: 'Fine', value: event.scheduledEndAt ? eventLogger.formatTimestamp(event.scheduledEndAt) : 'N/A', inline: true },
                { name: 'Canale', value: event.channel ? `<#${event.channelId}>` : 'Esterno', inline: true },
                { name: 'Creatore', value: event.creator ? `${event.creator.tag}` : 'Sconosciuto', inline: true },
                { name: 'Descrizione', value: eventLogger.truncate(event.description || 'Nessuna', 1024), inline: false }
            ],
            color: '#43B581'
        });
    }

    async handleGuildScheduledEventUpdate(oldEvent, newEvent) {
        const eventLogger = this.loggerFactory.getLogger('guildScheduledEventUpdate');
        if (!eventLogger) return;

        const changes = eventLogger.getDifferences(oldEvent, newEvent, [
            { key: 'name', name: 'Nome' },
            { key: 'description', name: 'Descrizione' },
            { key: 'status', name: 'Stato' },
            { key: 'scheduledStartAt', name: 'Inizio' },
            { key: 'scheduledEndAt', name: 'Fine' }
        ]);

        if (changes.length === 0) return;

        await eventLogger.log(newEvent.guild.id, {
            title: 'Evento Programmato Aggiornato',
            description: `L'evento **${newEvent.name}** è stato modificato`,
            fields: [
                { name: 'Evento', value: newEvent.name, inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                ...changes
            ],
            color: '#FAA61A'
        });
    }

    async handleGuildScheduledEventDelete(event) {
        const eventLogger = this.loggerFactory.getLogger('guildScheduledEventDelete');
        if (!eventLogger) return;

        await eventLogger.log(event.guild.id, {
            title: 'Evento Programmato Eliminato',
            description: `L'evento **${event.name}** è stato eliminato`,
            fields: [
                { name: 'Nome', value: event.name, inline: true },
                { name: 'ID', value: event.id, inline: true },
                { name: 'Era Programmato Per', value: eventLogger.formatTimestamp(event.scheduledStartAt), inline: false }
            ],
            color: '#F04747'
        });
    }
}

class InviteEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleInviteCreate(invite) {
        const eventLogger = this.loggerFactory.getLogger('inviteCreate');
        if (!eventLogger) return;

        await eventLogger.log(invite.guild.id, {
            title: 'Invito Creato',
            description: `È stato creato un nuovo invito: **${invite.code}**`,
            fields: [
                { name: 'Codice', value: invite.code, inline: true },
                { name: 'Canale', value: `<#${invite.channel.id}>`, inline: true },
                { name: 'Creato da', value: invite.inviter ? `${invite.inviter.tag}` : 'Sconosciuto', inline: true },
                { name: 'Usi Max', value: invite.maxUses === 0 ? 'Illimitati' : invite.maxUses.toString(), inline: true },
                { name: 'Durata', value: invite.maxAge === 0 ? 'Permanente' : `${invite.maxAge / 3600} ore`, inline: true },
                { name: 'Temporaneo', value: invite.temporary ? 'Sì' : 'No', inline: true },
                { name: 'URL', value: invite.url, inline: false }
            ],
            color: '#43B581'
        });
    }

    async handleInviteDelete(invite) {
        const eventLogger = this.loggerFactory.getLogger('inviteDelete');
        if (!eventLogger) return;

        await eventLogger.log(invite.guild.id, {
            title: 'Invito Eliminato',
            description: `L'invito **${invite.code}** è stato eliminato`,
            fields: [
                { name: 'Codice', value: invite.code, inline: true },
                { name: 'Canale', value: `<#${invite.channel.id}>`, inline: true },
                { name: 'Usi', value: invite.uses?.toString() || 'N/A', inline: true }
            ],
            color: '#F04747'
        });
    }
}

class UserEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleUserUpdate(oldUser, newUser) {
        // Traccia cambiamento di username/avatar nella storia
        await historyTracker.trackUsernameChange(oldUser, newUser).catch(() => {});

        const guilds = newUser.client.guilds.cache.filter(guild => guild.members.cache.has(newUser.id));

        for (const guild of guilds.values()) {
            const eventLogger = this.loggerFactory.getLogger('userUpdate');
            if (!eventLogger) continue;

            if (!this.configManager.isEventEnabled(guild.id, 'userUpdate')) continue;

            const changes = eventLogger.getDifferences(oldUser, newUser, [
                { key: 'username', name: 'Username' },
                { key: 'discriminator', name: 'Discriminator' },
                { key: 'globalName', name: 'Display Name' }
            ]);

            if (oldUser.avatarURL() !== newUser.avatarURL()) {
                changes.push({
                    name: 'Avatar',
                    value: oldUser.avatarURL() ? `[Prima](${oldUser.avatarURL()}) → [Dopo](${newUser.avatarURL() || 'rimosso'})` : 'Aggiunto',
                    inline: true
                });
            }

            if (changes.length === 0) continue;

            // Controlla watchlist
            const isWatched = await watchlist.isWatched(guild.id, newUser.id).catch(() => false);
            if (isWatched) {
                await watchlist.logWatchedAction(
                    guild,
                    newUser,
                    'Profilo Aggiornato',
                    changes.map(c => `**${c.name}:** ${c.value}`).join('\n'),
                    this.loggerFactory,
                    null
                ).catch(() => {});
            }

            await eventLogger.log(guild.id, {
                title: 'Utente Aggiornato',
                description: `L'utente ${newUser.tag} ha aggiornato il proprio profilo`,
                thumbnail: newUser.displayAvatarURL({ dynamic: true, size: 256 }),
                fields: [
                    { name: 'Utente', value: `${newUser.tag} (<@${newUser.id}>)`, inline: false },
                    ...changes
                ],
                color: '#FAA61A'
            });
        }
    }
}

module.exports = {
    RoleEventHandler,
    EmojiEventHandler,
    StickerEventHandler,
    GuildEventHandler,
    InviteEventHandler,
    UserEventHandler
};
