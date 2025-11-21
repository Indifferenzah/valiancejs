const { 
    EmbedBuilder, 
    AuditLogEvent, 
    WebhookClient, 
    Collection, 
    ChannelType 
} = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');
const path = require('path');

class LogCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'log.json');
        this.config = this.loadConfig();

        // Cache webhook client per URL
        this.webhookCache = new Collection();

        // Evita doppia registrazione
        if (!this.client.__logHandlersRegistered) {
            this.client.__logHandlersRegistered = true;
            this.setupEventListeners();
        }
    }

    /* ==========================
     *  CONFIG
     * ========================== */

    loadConfig() {
        return loadJsonSync(this.configPath, {});
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    reloadConfig() {
        this.config = this.loadConfig();
        logger.info('Log config ricaricata');
    }

    /* ==========================
     *  UTIL
     * ========================== */

    formatDateTime(date) {
        if (!date) return 'Sconosciuto';
        return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
    }

    formatTimeDelta(start, end) {
        if (!start || !end) return 'Sconosciuto';
        const diff = end.getTime() - start.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);

        return parts.length > 0 ? parts.join(' ') : 'Meno di un minuto';
    }

    getRolesString(member) {
        try {
            const roles = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => `<@&${role.id}>`)
                .join(' ');
            return roles || 'Nessun ruolo';
        } catch {
            return 'N/A';
        }
    }

    renderTemplate(template, variables) {
        if (!template) return '';
        let result = template;
        for (const [key, value] of Object.entries(variables || {})) {
            const safeValue = value !== undefined && value !== null ? String(value) : '';
            result = result.replace(new RegExp(`{${key}}`, 'g'), safeValue);
        }
        return result;
    }

    channelTypeToString(type) {
        switch (type) {
            case ChannelType.GuildText: return 'Testo';
            case ChannelType.GuildVoice: return 'Vocale';
            case ChannelType.GuildCategory: return 'Categoria';
            case ChannelType.GuildNews: return 'Annunci';
            case ChannelType.GuildStageVoice: return 'Stage';
            case ChannelType.GuildForum: return 'Forum';
            case ChannelType.PublicThread:
            case ChannelType.PrivateThread:
            case ChannelType.AnnouncementThread:
                return 'Thread';
            default: return 'Sconosciuto';
        }
    }

    formatAuditChanges(auditEntry) {
        if (!auditEntry || !auditEntry.changes) return 'Nessun dettaglio disponibile.';
        const parts = [];
        for (const change of auditEntry.changes) {
            const key = change.key;
            const oldVal = change.old ?? 'N/A';
            const newVal = change.new ?? 'N/A';
            parts.push(`\`${key}\`: \`${oldVal}\` → \`${newVal}\``);
        }
        return parts.join('\n').slice(0, 1000) || 'Nessun dettaglio disponibile.';
    }

    async getAuditEntry(action, targetId, guild) {
        try {
            const logs = await guild.fetchAuditLogs({ type: action, limit: 5 });
            return logs.entries.find(e => e.target?.id === targetId) || logs.entries.first() || null;
        } catch (err) {
            logger.warn(`Impossibile leggere audit log: ${err.message}`);
            return null;
        }
    }

    async getAuditUser(action, targetId, guild) {
        const entry = await this.getAuditEntry(action, targetId, guild);
        return entry?.executor?.tag || 'Sistema';
    }

    resolveLogTarget(target) {
        if (!target) return null;
        const value = String(target).trim();
        if (!value) return null;

        // Webhook URL
        if (value.startsWith('http://') || value.startsWith('https://')) {
            try {
                if (!this.webhookCache.has(value)) {
                    const client = new WebhookClient({ url: value });
                    this.webhookCache.set(value, client);
                }
                return { type: 'webhook', client: this.webhookCache.get(value) };
            } catch (err) {
                logger.error(`Webhook URL non valido: ${err.message}`);
                return null;
            }
        }

        // Channel ID
        const channel = this.client.channels.cache.get(value);
        if (!channel || !channel.isTextBased?.()) return null;
        return { type: 'channel', channel };
    }

    async sendLogEmbed(target, embedConfig, user = null, variables = {}) {
        try {
            if (!target || !embedConfig) return;

            const resolved = this.resolveLogTarget(target);
            if (!resolved) return;

            const title = this.renderTemplate(embedConfig.title || '', variables);
            const description = this.renderTemplate(embedConfig.description || '', variables);

            const embed = new EmbedBuilder()
                .setColor(embedConfig.color || 0x00ff00)
                .setTimestamp();

            if (title) embed.setTitle(title);
            if (description) embed.setDescription(description);

            if (embedConfig.thumbnail) {
                const thumbnail = this.renderTemplate(embedConfig.thumbnail, variables);
                if (thumbnail) embed.setThumbnail(thumbnail);
            }

            if (embedConfig.footer) {
                const footer = this.renderTemplate(embedConfig.footer, variables);
                if (footer) embed.setFooter({ text: footer });
            }

            if (embedConfig.author_header && user) {
                embed.setAuthor({ 
                    name: user.tag || user.username || 'Utente', 
                    iconURL: user.displayAvatarURL?.() 
                        ? user.displayAvatarURL() 
                        : user.avatarURL?.() 
                            ? user.avatarURL() 
                            : null 
                });
            }

            const payload = { embeds: [embed] };

            if (resolved.type === 'channel') {
                await resolved.channel.send(payload);
            } else if (resolved.type === 'webhook') {
                await resolved.client.send(payload);
            }
        } catch (error) {
            logger.error(`Errore nell'invio del log: ${error.message}`);
        }
    }

    /* ==========================
     *  EVENT LISTENERS
     * ========================== */

    setupEventListeners() {
        // MEMBER JOIN
        this.client.on('guildMemberAdd', async (member) => {
            try {
                await new Promise(r => setTimeout(r, 5000));

                const variables = {
                    mention: member.toString(),
                    username: member.user.username,
                    id: member.user.id,
                    avatar: member.user.displayAvatarURL(),
                    created_at: this.formatDateTime(member.user.createdAt),
                    joined_at: this.formatDateTime(member.joinedAt),
                    total_members: member.guild.memberCount.toString()
                };

                await this.sendLogEmbed(
                    this.config.join_channel,
                    this.config.join_message,
                    member.user,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log join: ${err.message}`);
            }
        });

        // MEMBER LEAVE
        this.client.on('guildMemberRemove', async (member) => {
            try {
                await new Promise(r => setTimeout(r, 5000));

                const leftAt = new Date();
                const timeInServer = this.formatTimeDelta(member.joinedAt, leftAt);
                const roles = this.getRolesString(member);

                const variables = {
                    mention: member.toString(),
                    username: member.user.username,
                    id: member.user.id,
                    avatar: member.user.displayAvatarURL(),
                    created_at: this.formatDateTime(member.user.createdAt),
                    left_at: this.formatDateTime(leftAt),
                    time_in_server: timeInServer,
                    roles: roles,
                    total_members: member.guild.memberCount.toString()
                };

                await this.sendLogEmbed(
                    this.config.leave_channel,
                    this.config.leave_message,
                    member.user,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log leave: ${err.message}`);
            }
        });

        // MEMBER BAN / UNBAN
        this.client.on('guildBanAdd', async (ban) => {
            try {
                const staffer = await this.getAuditUser(AuditLogEvent.MemberBanAdd, ban.user.id, ban.guild);
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

                await this.sendLogEmbed(
                    this.config.moderation_channel,
                    this.config.ban_message,
                    ban.user,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log ban: ${err.message}`);
            }
        });

        this.client.on('guildBanRemove', async (ban) => {
            try {
                const staffer = await this.getAuditUser(AuditLogEvent.MemberBanRemove, ban.user.id, ban.guild);

                const variables = {
                    mention: ban.user.toString(),
                    id: ban.user.id,
                    avatar: ban.user.displayAvatarURL(),
                    staffer
                };

                await this.sendLogEmbed(
                    this.config.moderation_channel,
                    this.config.unban_message,
                    ban.user,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log unban: ${err.message}`);
            }
        });

        // MEMBER UPDATE (ruoli + boost)
        this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
            try {
                if (!oldMember || !newMember) return;

                const guild = newMember.guild;

                // BOOST
                const oldBoost = oldMember.premiumSince;
                const newBoost = newMember.premiumSince;
                if (!oldBoost && newBoost) {
                    const variables = {
                        mention: newMember.toString(),
                        id: newMember.id,
                        avatar: newMember.user.displayAvatarURL()
                    };

                    await this.sendLogEmbed(
                        this.config.boost_channel,
                        this.config.boost_message,
                        newMember.user,
                        variables
                    );
                }

                // ROLE CHANGES
                const oldRoles = oldMember.roles.cache;
                const newRoles = newMember.roles.cache;

                const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
                const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

                if (addedRoles.size === 0 && removedRoles.size === 0) return;

                const staffer = await this.getAuditUser(AuditLogEvent.MemberRoleUpdate, newMember.id, guild);

                const variables = {
                    mention: newMember.toString(),
                    id: newMember.id,
                    avatar: newMember.user.displayAvatarURL(),
                    staffer,
                    total_members: guild.memberCount.toString(),
                    added_roles: addedRoles.map(r => `<@&${r.id}>`).join(' ') || 'Nessuno',
                    removed_roles: removedRoles.map(r => `<@&${r.id}>`).join(' ') || 'Nessuno'
                };

                await this.sendLogEmbed(
                    this.config.moderation_channel,
                    this.config.role_change_message,
                    newMember.user,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log member update: ${err.message}`);
            }
        });

        // VOICE STATE
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            try {
                if (newState.member?.user?.bot) return;
                const member = newState.member || oldState.member;
                if (!member) return;

                // Join
                if (!oldState.channel && newState.channel) {
                    const variables = {
                        mention: member.toString(),
                        id: member.id,
                        avatar: member.user.displayAvatarURL(),
                        channel: newState.channel.toString()
                    };

                    await this.sendLogEmbed(
                        this.config.voice_channel,
                        this.config.vc_join_message,
                        member.user,
                        variables
                    );
                }
                // Leave
                else if (oldState.channel && !newState.channel) {
                    const variables = {
                        mention: member.toString(),
                        id: member.id,
                        avatar: member.user.displayAvatarURL(),
                        channel: oldState.channel.toString()
                    };

                    await this.sendLogEmbed(
                        this.config.voice_channel,
                        this.config.vc_leave_message,
                        member.user,
                        variables
                    );
                }
                // Move
                else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
                    const variables = {
                        mention: member.toString(),
                        id: member.id,
                        avatar: member.user.displayAvatarURL(),
                        old_channel: oldState.channel.toString(),
                        new_channel: newState.channel.toString()
                    };

                    await this.sendLogEmbed(
                        this.config.voice_channel,
                        this.config.vc_move_message,
                        member.user,
                        variables
                    );
                }
            } catch (err) {
                logger.error(`Errore log voice state: ${err.message}`);
            }
        });

        // MESSAGE DELETE
        this.client.on('messageDelete', async (message) => {
            try {
                if (!message || message.partial) return;
                if (message.author?.bot) return;
                if (!message.content) return;

                const variables = {
                    mention: message.author.toString(),
                    id: message.author.id,
                    avatar: message.author.displayAvatarURL(),
                    channel: message.channel.toString(),
                    content: message.content.substring(0, 1000)
                };

                await this.sendLogEmbed(
                    this.config.message_channel,
                    this.config.message_delete_message,
                    message.author,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log message delete: ${err.message}`);
            }
        });

        // MESSAGE UPDATE
        this.client.on('messageUpdate', async (oldMessage, newMessage) => {
            try {
                if (!newMessage || newMessage.partial) return;
                if (newMessage.author?.bot) return;
                if (!oldMessage.content || !newMessage.content) return;
                if (oldMessage.content === newMessage.content) return;

                const variables = {
                    mention: newMessage.author.toString(),
                    id: newMessage.author.id,
                    avatar: newMessage.author.displayAvatarURL(),
                    channel: newMessage.channel.toString(),
                    old_content: oldMessage.content.substring(0, 500),
                    new_content: newMessage.content.substring(0, 500)
                };

                await this.sendLogEmbed(
                    this.config.message_channel,
                    this.config.message_edit_message,
                    newMessage.author,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log message update: ${err.message}`);
            }
        });

        /* ==========================
         *  SERVER STRUCTURE LOGS
         * ========================== */

        // CHANNEL CREATE / DELETE / UPDATE
        this.client.on('channelCreate', async (channel) => {
            try {
                const guild = channel.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.ChannelCreate, channel.id, guild);

                const variables = {
                    channel: channel.toString(),
                    staffer,
                    type: this.channelTypeToString(channel.type),
                    id: channel.id
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.channel_create_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log channel create: ${err.message}`);
            }
        });

        this.client.on('channelDelete', async (channel) => {
            try {
                const guild = channel.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.ChannelDelete, channel.id, guild);

                const variables = {
                    name: channel.name,
                    staffer,
                    type: this.channelTypeToString(channel.type),
                    id: channel.id
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.channel_delete_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log channel delete: ${err.message}`);
            }
        });

        // CHANNEL UPDATE
        this.client.on('channelUpdate', async (oldChannel, newChannel) => {
            try {
                const guild = newChannel.guild;
                if (!guild) return;

                const entry = await this.getAuditEntry(AuditLogEvent.ChannelUpdate, newChannel.id, guild);
                if (!entry) return;

                const staffer = entry.executor?.tag || 'Sistema';
                const changes = this.formatAuditChanges(entry);

                // Evita conflitto con PermissionOverwriteUpdate
                if (entry.action === AuditLogEvent.PermissionOverwriteUpdate) return;

                const oldSlow = oldChannel.rateLimitPerUser || 0;
                const newSlow = newChannel.rateLimitPerUser || 0;
                const slowmodeText = oldSlow !== newSlow
                    ? `Slowmode: ${oldSlow}s → ${newSlow}s`
                    : 'Nessuna modifica slowmode';

                const variables = {
                    channel: newChannel.toString(),
                    staffer,
                    changes,
                    slowmode: slowmodeText
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.channel_update_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log channel update: ${err.message}`);
            }
        });

        // THREAD CREATE / DELETE / UPDATE
        this.client.on('threadCreate', async (thread) => {
            try {
                const guild = thread.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.ThreadCreate, thread.id, guild);

                const variables = {
                    thread: thread.toString(),
                    staffer,
                    id: thread.id
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.thread_create_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log thread create: ${err.message}`);
            }
        });

        this.client.on('threadDelete', async (thread) => {
            try {
                const guild = thread.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.ThreadDelete, thread.id, guild);

                const variables = {
                    name: thread.name,
                    staffer,
                    id: thread.id
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.thread_delete_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log thread delete: ${err.message}`);
            }
        });

        this.client.on('threadUpdate', async (oldThread, newThread) => {
            try {
                const guild = newThread.guild;
                if (!guild) return;

                const entry = await this.getAuditEntry(AuditLogEvent.ThreadUpdate, newThread.id, guild);
                const staffer = entry?.executor?.tag || 'Sistema';
                const changes = this.formatAuditChanges(entry);

                const variables = {
                    thread: newThread.toString(),
                    staffer,
                    changes
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.thread_update_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log thread update: ${err.message}`);
            }
        });

        // CHANNEL PERMISSION OVERWRITE UPDATE
        this.client.on('channelUpdate', async (oldChannel, newChannel) => {
            try {
                const guild = newChannel.guild;
                if (!guild) return;

                const entry = await this.getAuditEntry(AuditLogEvent.PermissionOverwriteUpdate, newChannel.id, guild);
                if (!entry) return;

                const staffer = entry.executor?.tag || 'Sistema';

                const target = entry.target; // ruolo o user
                let targetMention = 'Sconosciuto';

                if (target) {
                    if (target.constructor.name === 'Role') {
                        targetMention = `<@&${target.id}>`;
                    } else {
                        targetMention = `<@${target.id}>`;
                    }
                }

                const changesRaw = entry.changes || [];
                const added = [];
                const removed = [];

                for (const change of changesRaw) {
                    if (change.key !== 'allow' && change.key !== 'deny') continue;

                    const oldPerms = change.old ?? 0;
                    const newPerms = change.new ?? 0;

                    const { PermissionsBitField } = require('discord.js');
                    const oldList = new PermissionsBitField(BigInt(oldPerms)).toArray();
                    const newList = new PermissionsBitField(BigInt(newPerms)).toArray();

                    for (const perm of newList) if (!oldList.includes(perm)) added.push(perm);
                    for (const perm of oldList) if (!newList.includes(perm)) removed.push(perm);
                }

                const variables = {
                    channel: newChannel.toString(),
                    staffer,
                    target: targetMention,
                    added_perms: added.length ? added.join(', ') : 'Nessuno',
                    removed_perms: removed.length ? removed.join(', ') : 'Nessuno'
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.channel_permission_update_message,
                    null,
                    variables
                );

            } catch (err) {
                logger.error(`Errore perm overwrite update: ${err.message}`);
            }
        });

        // WEBHOOK UPDATE (create/delete/update -> via audit)
        this.client.on('webhookUpdate', async (channel) => {
            try {
                const guild = channel.guild;
                if (!guild) return;

                // Controllo gli ultimi log per capire tipo azione
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
                const changes = this.formatAuditChanges(entry);

                const baseVars = {
                    staffer,
                    id: entry.target?.id || 'N/A',
                    name: entry.target?.name || 'N/A'
                };

                if (entry.action === AuditLogEvent.WebhookCreate) {
                    await this.sendLogEmbed(
                        this.config.guildlog_channel,
                        this.config.webhook_create_message,
                        null,
                        baseVars
                    );
                } else if (entry.action === AuditLogEvent.WebhookDelete) {
                    await this.sendLogEmbed(
                        this.config.guildlog_channel,
                        this.config.webhook_delete_message,
                        null,
                        baseVars
                    );
                } else if (entry.action === AuditLogEvent.WebhookUpdate) {
                    await this.sendLogEmbed(
                        this.config.guildlog_channel,
                        this.config.webhook_update_message,
                        null,
                        { ...baseVars, changes }
                    );
                }
            } catch (err) {
                logger.error(`Errore log webhook update: ${err.message}`);
            }
        });

        // ROLE CREATE / DELETE
        this.client.on('roleCreate', async (role) => {
            try {
                const guild = role.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.RoleCreate, role.id, guild);

                const variables = {
                    role: `<@&${role.id}>`,
                    staffer,
                    id: role.id
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.role_create_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log role create: ${err.message}`);
            }
        });

        this.client.on('roleDelete', async (role) => {
            try {
                const guild = role.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.RoleDelete, role.id, guild);

                const variables = {
                    name: role.name,
                    staffer,
                    id: role.id
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.role_delete_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log role delete: ${err.message}`);
            }
        });

        // GUILD UPDATE
        this.client.on('guildUpdate', async (oldGuild, newGuild) => {
            try {
                const entry = await this.getAuditEntry(AuditLogEvent.GuildUpdate, newGuild.id, newGuild);
                const staffer = entry?.executor?.tag || 'Sistema';
                const changes = this.formatAuditChanges(entry);

                const variables = {
                    staffer,
                    changes
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.guild_update_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log guild update: ${err.message}`);
            }
        });

        // EMOJI
        this.client.on('emojiCreate', async (emoji) => {
            try {
                const guild = emoji.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.EmojiCreate, emoji.id, guild);

                const variables = {
                    emojis: `${emoji} (\`${emoji.name}\`)`,
                    staffer
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.emoji_create_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log emoji create: ${err.message}`);
            }
        });

        this.client.on('emojiDelete', async (emoji) => {
            try {
                const guild = emoji.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.EmojiDelete, emoji.id, guild);

                const variables = {
                    emojis: `${emoji.name}`,
                    staffer
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.emoji_delete_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log emoji delete: ${err.message}`);
            }
        });

        this.client.on('emojiUpdate', async (oldEmoji, newEmoji) => {
            try {
                const guild = newEmoji.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.EmojiUpdate, newEmoji.id, guild);

                const variables = {
                    emojis: `${oldEmoji.name} → ${newEmoji.name}`,
                    staffer
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.emoji_update_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log emoji update: ${err.message}`);
            }
        });

        // STICKER
        this.client.on('stickerCreate', async (sticker) => {
            try {
                const guild = sticker.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.StickerCreate, sticker.id, guild);

                const variables = {
                    stickers: `${sticker.name}`,
                    staffer
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.sticker_create_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log sticker create: ${err.message}`);
            }
        });

        this.client.on('stickerDelete', async (sticker) => {
            try {
                const guild = sticker.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.StickerDelete, sticker.id, guild);

                const variables = {
                    stickers: `${sticker.name}`,
                    staffer
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.sticker_delete_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log sticker delete: ${err.message}`);
            }
        });

        this.client.on('stickerUpdate', async (oldSticker, newSticker) => {
            try {
                const guild = newSticker.guild;
                if (!guild) return;

                const staffer = await this.getAuditUser(AuditLogEvent.StickerUpdate, newSticker.id, guild);

                const variables = {
                    stickers: `${oldSticker.name} → ${newSticker.name}`,
                    staffer
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.sticker_update_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log sticker update: ${err.message}`);
            }
        });

        /* ==========================
         *  EXTRA: REACTION / PIN / INVITE / PRESENCE / USER
         * ========================== */

        // REACTION ADD / REMOVE
        this.client.on('messageReactionAdd', async (reaction, user) => {
            try {
                if (user.bot) return;
                if (reaction.partial) await reaction.fetch();

                const variables = {
                    emoji: reaction.emoji.toString(),
                    user: user.toString(),
                    channel: reaction.message.channel.toString(),
                    message_id: reaction.message.id
                };

                await this.sendLogEmbed(
                    this.config.message_channel,
                    this.config.reaction_add_message,
                    user,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log reaction add: ${err.message}`);
            }
        });

        this.client.on('messageReactionRemove', async (reaction, user) => {
            try {
                if (user.bot) return;
                if (reaction.partial) await reaction.fetch();

                const variables = {
                    emoji: reaction.emoji.toString(),
                    user: user.toString(),
                    channel: reaction.message.channel.toString(),
                    message_id: reaction.message.id
                };

                await this.sendLogEmbed(
                    this.config.message_channel,
                    this.config.reaction_remove_message,
                    user,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log reaction remove: ${err.message}`);
            }
        });

        // MESSAGE PIN / UNPIN
        this.client.on('messageUpdate', async (oldMessage, newMessage) => {
            try {
                if (!oldMessage || !newMessage) return;
                if (!oldMessage.pinned && newMessage.pinned) {
                    const variables = {
                        channel: newMessage.channel.toString(),
                        message_id: newMessage.id,
                        author: newMessage.author?.toString() || 'Sconosciuto'
                    };

                    await this.sendLogEmbed(
                        this.config.message_channel,
                        this.config.message_pin_message,
                        newMessage.author,
                        variables
                    );
                } else if (oldMessage.pinned && !newMessage.pinned) {
                    const variables = {
                        channel: newMessage.channel.toString(),
                        message_id: newMessage.id,
                        author: newMessage.author?.toString() || 'Sconosciuto'
                    };

                    await this.sendLogEmbed(
                        this.config.message_channel,
                        this.config.message_unpin_message,
                        newMessage.author,
                        variables
                    );
                }
            } catch (err) {
                // silenzioso, c'è già un altro handler messageUpdate sopra
            }
        });

        // INVITES
        this.client.on('inviteCreate', async (invite) => {
            try {
                const guild = invite.guild;
                if (!guild) return;

                const variables = {
                    code: invite.code,
                    channel: invite.channel?.toString() || 'N/A',
                    inviter: invite.inviter?.tag || 'Sconosciuto',
                    max_uses: invite.maxUses ?? 'Illimitato'
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.invite_create_message,
                    invite.inviter || null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log invite create: ${err.message}`);
            }
        });

        this.client.on('inviteDelete', async (invite) => {
            try {
                const guild = invite.guild;
                if (!guild) return;

                const variables = {
                    code: invite.code,
                    channel: invite.channel?.toString() || 'N/A'
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.invite_delete_message,
                    null,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log invite delete: ${err.message}`);
            }
        });

        // PRESENCE UPDATE
        this.client.on('presenceUpdate', async (oldPresence, newPresence) => {
            try {
                if (!newPresence || !newPresence.user || newPresence.user.bot) return;

                const oldStatus = oldPresence?.status || 'offline';
                const newStatus = newPresence.status || 'offline';

                if (oldStatus === newStatus) return;

                const variables = {
                    user: newPresence.user.toString(),
                    old_status: oldStatus,
                    new_status: newStatus
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.presence_update_message,
                    newPresence.user,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log presence update: ${err.message}`);
            }
        });

        // USER UPDATE (avatar / username)
        this.client.on('userUpdate', async (oldUser, newUser) => {
            try {
                if (newUser.bot) return;

                let changed = false;
                let changes = [];

                if (oldUser.username !== newUser.username) {
                    changed = true;
                    changes.push(`Username: \`${oldUser.username}\` → \`${newUser.username}\``);
                }

                if (oldUser.avatar !== newUser.avatar) {
                    changed = true;
                    changes.push('Avatar aggiornato');
                }

                if (!changed) return;

                const variables = {
                    user: newUser.toString(),
                    id: newUser.id,
                    changes: changes.join('\n'),
                    avatar: newUser.displayAvatarURL()
                };

                await this.sendLogEmbed(
                    this.config.guildlog_channel,
                    this.config.user_update_message,
                    newUser,
                    variables
                );
            } catch (err) {
                logger.error(`Errore log user update: ${err.message}`);
            }
        });
    }

    /* ==========================
     *  PUBLIC METHODS PER ALTRI COG
     * ========================== */

    // Moderation manuale
    async logBan(user, staffer, reason) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer,
            reason: reason || 'Nessuna ragione'
        };

        await this.sendLogEmbed(
            this.config.moderation_channel,
            this.config.ban_message,
            user,
            variables
        );
    }

    async logKick(user, staffer, reason) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer,
            reason: reason || 'Nessuna ragione'
        };

        await this.sendLogEmbed(
            this.config.moderation_channel,
            this.config.kick_message,
            user,
            variables
        );
    }

    async logMute(user, staffer, reason, duration) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer,
            reason: reason || 'Nessuna ragione',
            duration: duration || 'Permanente'
        };

        await this.sendLogEmbed(
            this.config.moderation_channel,
            this.config.mute_message,
            user,
            variables
        );
    }

    async logUnmute(user, staffer) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer
        };

        await this.sendLogEmbed(
            this.config.moderation_channel,
            this.config.unmute_message,
            user,
            variables
        );
    }

    async logWarn(user, staffer, reason, totalWarns) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer,
            reason: reason || 'Nessuna ragione',
            total_warns: String(totalWarns ?? 0)
        };

        await this.sendLogEmbed(
            this.config.moderation_channel,
            this.config.warn_message,
            user,
            variables
        );
    }

    async logUnwarn(user, staffer, warnId) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer,
            warn_id: String(warnId ?? 'N/A')
        };

        await this.sendLogEmbed(
            this.config.moderation_channel,
            this.config.unwarn_message,
            user,
            variables
        );
    }

    async logClearWarns(user, staffer, count) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer,
            count: String(count ?? 0)
        };

        await this.sendLogEmbed(
            this.config.moderation_channel,
            this.config.clearwarns_message,
            user,
            variables
        );
    }

    async logNick(user, staffer, newNick) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer,
            new_nick: newNick
        };

        await this.sendLogEmbed(
            this.config.moderation_channel,
            this.config.nick_message,
            user,
            variables
        );
    }

    // Ticket
    async logTicketOpen(user, channel, number, category) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            channel,
            number,
            category
        };

        await this.sendLogEmbed(
            this.config.ticket_channel,
            this.config.ticket_open_message,
            user,
            variables
        );
    }

    async logTicketClose(channel, opener, staffer, number) {
        const variables = {
            channel,
            opener,
            staffer,
            number
        };

        await this.sendLogEmbed(
            this.config.ticket_channel,
            this.config.ticket_close_message,
            null,
            variables
        );
    }

    async logTicketRename(channel, newName, staffer, number) {
        const variables = {
            channel,
            new_name: newName,
            staffer,
            number
        };

        await this.sendLogEmbed(
            this.config.ticket_channel,
            this.config.ticket_rename_message,
            null,
            variables
        );
    }

    async logTicketAdd(member, channel, staffer, number) {
        const variables = {
            member,
            channel,
            staffer,
            number
        };

        await this.sendLogEmbed(
            this.config.ticket_channel,
            this.config.ticket_add_message,
            null,
            variables
        );
    }

    async logTicketRemove(member, channel, staffer, number) {
        const variables = {
            member,
            channel,
            staffer,
            number
        };

        await this.sendLogEmbed(
            this.config.ticket_channel,
            this.config.ticket_remove_message,
            null,
            variables
        );
    }

    // Autorole
    async logAutoroleAdd(user, role) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            role: role.toString()
        };

        await this.sendLogEmbed(
            this.config.autorole_channel,
            this.config.autorole_add_message,
            user,
            variables
        );
    }

    async logAutoroleRemove(user, role) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            role: role.toString()
        };

        await this.sendLogEmbed(
            this.config.autorole_channel,
            this.config.autorole_remove_message,
            user,
            variables
        );
    }

    // Automod
    async logAutomodMute(user, reason, duration) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            reason: reason || 'Nessuna ragione',
            duration: duration || 'Permanente'
        };

        await this.sendLogEmbed(
            this.config.automod_channel,
            this.config.automod_mute_message,
            user,
            variables
        );
    }

    async logAutomodWarn(user, word) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            word
        };

        await this.sendLogEmbed(
            this.config.automod_channel,
            this.config.automod_warn_message,
            user,
            variables
        );
    }
}

function setup(client) {
    const cog = new LogCog(client);
    client.logCog = cog;
    return cog;
}

module.exports = { setup, LogCog };
