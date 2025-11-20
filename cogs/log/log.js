const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');
const path = require('path');

class LogCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'log.json');
        this.config = this.loadConfig();
        this.setupEventListeners();
    }

    loadConfig() {
        return loadJsonSync(this.configPath, {});
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    reloadConfig() {
        this.config = this.loadConfig();
        logger.info('Log config reloaded');
    }

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
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{${key}}`, 'g'), value || '');
        }
        return result;
    }

    async getAuditUser(action, targetId, guild) {
        try {
            const auditLogs = await guild.fetchAuditLogs({ type: action, limit: 5 });
            const entry = auditLogs.entries.find(entry => entry.target?.id === targetId);
            return entry ? entry.executor.tag : 'Sistema';
        } catch {
            return 'Sistema';
        }
    }

    async sendLogEmbed(channelId, embedConfig, guild = null, variables = {}) {
        try {
            if (!channelId || !embedConfig) return;
            
            const channel = this.client.channels.cache.get(channelId);
            if (!channel) return;

            const title = this.renderTemplate(embedConfig.title || '', variables);
            const description = this.renderTemplate(embedConfig.description || '', variables);
            
            const embed = new EmbedBuilder()
                .setTitle(title || null)
                .setDescription(description || null)
                .setColor(embedConfig.color || 0x00ff00)
                .setTimestamp();

            if (embedConfig.thumbnail) {
                const thumbnail = this.renderTemplate(embedConfig.thumbnail, variables);
                embed.setThumbnail(thumbnail);
            }

            if (embedConfig.footer) {
                const footer = this.renderTemplate(embedConfig.footer, variables);
                embed.setFooter({ text: footer });
            }

            if (embedConfig.author_header && guild && guild.iconURL()) {
                embed.setAuthor({ name: guild.name, iconURL: guild.iconURL() });
            }

            await channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error(`Error sending log embed: ${error.message}`);
        }
    }

    setupEventListeners() {
        // Member join
        this.client.on('guildMemberAdd', async (member) => {
            try {
                await new Promise(resolve => setTimeout(resolve, 5000));
                
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
                    this.config.join_log_channel_id,
                    this.config.join_message,
                    member.guild,
                    variables
                );
            } catch (error) {
                logger.error(`Error in member join log: ${error.message}`);
            }
        });

        // Member leave
        this.client.on('guildMemberRemove', async (member) => {
            try {
                await new Promise(resolve => setTimeout(resolve, 5000));
                
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
                    this.config.leave_log_channel_id,
                    this.config.leave_message,
                    member.guild,
                    variables
                );
            } catch (error) {
                logger.error(`Error in member leave log: ${error.message}`);
            }
        });

        // Member ban
        this.client.on('guildBanAdd', async (ban) => {
            try {
                const staffer = await this.getAuditUser(AuditLogEvent.MemberBanAdd, ban.user.id, ban.guild);
                
                const auditLogs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
                const entry = auditLogs.entries.first();
                const reason = entry?.reason || 'Nessuna ragione';

                const variables = {
                    mention: ban.user.toString(),
                    id: ban.user.id,
                    avatar: ban.user.displayAvatarURL(),
                    staffer: staffer,
                    reason: reason
                };

                await this.sendLogEmbed(
                    this.config.moderation_log_channel_id,
                    this.config.ban_message,
                    ban.guild,
                    variables
                );
            } catch (error) {
                logger.error(`Error in ban log: ${error.message}`);
            }
        });

        // Member unban
        this.client.on('guildBanRemove', async (ban) => {
            try {
                const staffer = await this.getAuditUser(AuditLogEvent.MemberBanRemove, ban.user.id, ban.guild);

                const variables = {
                    mention: ban.user.toString(),
                    id: ban.user.id,
                    avatar: ban.user.displayAvatarURL(),
                    staffer: staffer
                };

                await this.sendLogEmbed(
                    this.config.moderation_log_channel_id,
                    this.config.unban_message,
                    ban.guild,
                    variables
                );
            } catch (error) {
                logger.error(`Error in unban log: ${error.message}`);
            }
        });

        // Voice state updates
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            try {
                if (newState.member.user.bot) return;

                const member = newState.member;
                
                // Joined voice channel
                if (!oldState.channel && newState.channel) {
                    const variables = {
                        mention: member.toString(),
                        id: member.id,
                        avatar: member.user.displayAvatarURL(),
                        channel: newState.channel.toString()
                    };

                    await this.sendLogEmbed(
                        this.config.voice_log_channel_id,
                        this.config.vc_join_message,
                        member.guild,
                        variables
                    );
                }
                // Left voice channel
                else if (oldState.channel && !newState.channel) {
                    const variables = {
                        mention: member.toString(),
                        id: member.id,
                        avatar: member.user.displayAvatarURL(),
                        channel: oldState.channel.toString()
                    };

                    await this.sendLogEmbed(
                        this.config.voice_log_channel_id,
                        this.config.vc_leave_message,
                        member.guild,
                        variables
                    );
                }
                // Moved between channels
                else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
                    const variables = {
                        mention: member.toString(),
                        id: member.id,
                        avatar: member.user.displayAvatarURL(),
                        old_channel: oldState.channel.toString(),
                        new_channel: newState.channel.toString()
                    };

                    await this.sendLogEmbed(
                        this.config.voice_log_channel_id,
                        this.config.vc_move_message,
                        member.guild,
                        variables
                    );
                }
            } catch (error) {
                logger.error(`Error in voice state log: ${error.message}`);
            }
        });

        // Message delete
        this.client.on('messageDelete', async (message) => {
            try {
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
                    this.config.message_log_channel_id,
                    this.config.message_delete_message,
                    message.guild,
                    variables
                );
            } catch (error) {
                logger.error(`Error in message delete log: ${error.message}`);
            }
        });

        // Message edit
        this.client.on('messageUpdate', async (oldMessage, newMessage) => {
            try {
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
                    this.config.message_log_channel_id,
                    this.config.message_edit_message,
                    newMessage.guild,
                    variables
                );
            } catch (error) {
                logger.error(`Error in message edit log: ${error.message}`);
            }
        });
    }

    // Moderation logging methods
    async logBan(user, staffer, reason) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer: staffer,
            reason: reason || 'Nessuna ragione'
        };

        await this.sendLogEmbed(
            this.config.moderation_log_channel_id,
            this.config.ban_message,
            user.guild,
            variables
        );
    }

    async logKick(user, staffer, reason) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer: staffer,
            reason: reason || 'Nessuna ragione'
        };

        await this.sendLogEmbed(
            this.config.moderation_log_channel_id,
            this.config.kick_message,
            user.guild,
            variables
        );
    }

    async logMute(user, staffer, reason, duration) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer: staffer,
            reason: reason || 'Nessuna ragione',
            duration: duration || 'Permanente'
        };

        await this.sendLogEmbed(
            this.config.moderation_log_channel_id,
            this.config.mute_message,
            user.guild,
            variables
        );
    }

    async logUnmute(user, staffer) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer: staffer
        };

        await this.sendLogEmbed(
            this.config.moderation_log_channel_id,
            this.config.unmute_message,
            user.guild,
            variables
        );
    }

    async logWarn(user, staffer, reason, totalWarns) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer: staffer,
            reason: reason || 'Nessuna ragione',
            total_warns: totalWarns.toString()
        };

        await this.sendLogEmbed(
            this.config.moderation_log_channel_id,
            this.config.warn_message,
            user.guild,
            variables
        );
    }

    async logUnwarn(user, staffer, warnId) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer: staffer,
            warn_id: warnId.toString()
        };

        await this.sendLogEmbed(
            this.config.moderation_log_channel_id,
            this.config.unwarn_message,
            user.guild,
            variables
        );
    }

    async logClearWarns(user, staffer, count) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer: staffer,
            count: count.toString()
        };

        await this.sendLogEmbed(
            this.config.moderation_log_channel_id,
            this.config.clearwarns_message,
            user.guild,
            variables
        );
    }

    async logNick(user, staffer, newNick) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            staffer: staffer,
            new_nick: newNick
        };

        await this.sendLogEmbed(
            this.config.moderation_log_channel_id,
            this.config.nick_message,
            user.guild,
            variables
        );
    }

    // Ticket logging methods
    async logTicketOpen(user, channel, number, category) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            channel: channel,
            number: number,
            category: category
        };

        await this.sendLogEmbed(
            this.config.ticket_log_channel_id,
            this.config.ticket_open_message,
            user.guild,
            variables
        );
    }

    async logTicketClose(channel, opener, staffer, number) {
        const variables = {
            channel: channel,
            opener: opener,
            staffer: staffer,
            number: number
        };

        await this.sendLogEmbed(
            this.config.ticket_log_channel_id,
            this.config.ticket_close_message,
            null,
            variables
        );
    }

    // Autorole logging methods
    async logAutoroleAdd(user, role) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            role: role.toString()
        };

        await this.sendLogEmbed(
            this.config.autorole_log_channel_id,
            this.config.autorole_add_message,
            user.guild,
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
            this.config.autorole_log_channel_id,
            this.config.autorole_remove_message,
            user.guild,
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