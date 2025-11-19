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
        return loadJsonSync(this.configPath, {
            join_log_channel_id: "",
            leave_log_channel_id: "",
            moderation_log_channel_id: "",
            ticket_log_channel_id: "",
            autorole_log_channel_id: "",
            automod_log_channel_id: "",
            message_log_channel_id: "",
            boost_log_channel_id: "",
            voice_log_channel_id: "",
            join_message: {
                title: "📥 Membro Entrato",
                description: "{mention} è entrato nel server\n\n**Account creato:** {created_at}\n**Membri totali:** {total_members}",
                color: 0x00ff00,
                thumbnail: "{avatar}",
                footer: "ID: {id}"
            },
            leave_message: {
                title: "📤 Membro Uscito",
                description: "{mention} ha lasciato il server\n\n**Tempo nel server:** {time_in_server}\n**Ruoli:** {roles}",
                color: 0xff0000,
                thumbnail: "{avatar}",
                footer: "ID: {id}"
            }
        });
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
            if (!channelId) return;
            
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

            if (guild && guild.iconURL()) {
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
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                
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
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                
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

                logger.info(`Member banned: ${ban.user.username} (${ban.user.id}) by ${staffer} - Reason: ${reason}`);
                
                const variables = {
                    mention: ban.user.toString(),
                    id: ban.user.id,
                    avatar: ban.user.displayAvatarURL(),
                    author_name: ban.user.username,
                    total_members: ban.guild.memberCount.toString(),
                    staffer: staffer,
                    reason: reason
                };

                await this.sendLogEmbed(
                    this.config.moderation_log_channel_id,
                    { title: '🔨 Utente Bannato', description: '{mention} è stato bannato\n\n**Moderatore:** {staffer}\n**Motivo:** {reason}', color: 0xff0000 },
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

                logger.info(`Member unbanned: ${ban.user.username} (${ban.user.id}) by ${staffer}`);
                
                const variables = {
                    mention: ban.user.toString(),
                    id: ban.user.id,
                    avatar: ban.user.displayAvatarURL(),
                    author_name: ban.user.username,
                    total_members: ban.guild.memberCount.toString(),
                    staffer: staffer
                };

                await this.sendLogEmbed(
                    this.config.moderation_log_channel_id,
                    { title: '✅ Utente Sbannato', description: '{mention} è stato sbannato\n\n**Moderatore:** {staffer}', color: 0x00ff00 },
                    ban.guild,
                    variables
                );
            } catch (error) {
                logger.error(`Error in unban log: ${error.message}`);
            }
        });

        // Message delete
        this.client.on('messageDelete', async (message) => {
            try {
                if (!this.config.message_log_channel_id || !message.guild || message.author?.bot) return;
                
                const variables = {
                    mention: message.author.toString(),
                    id: message.author.id,
                    avatar: message.author.displayAvatarURL(),
                    author_name: message.author.username,
                    total_members: message.guild.memberCount.toString(),
                    channel: message.channel.toString(),
                    content: (message.content || 'Nessun contenuto').substring(0, 1000)
                };

                await this.sendLogEmbed(
                    this.config.message_log_channel_id,
                    { title: '🗑️ Messaggio Eliminato', description: '**Autore:** {mention}\n**Canale:** {channel}\n**Contenuto:** {content}', color: 0xff0000 },
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
                if (!this.config.message_log_channel_id || !newMessage.guild || newMessage.author?.bot) return;
                if (oldMessage.content === newMessage.content) return;
                
                const variables = {
                    mention: newMessage.author.toString(),
                    id: newMessage.author.id,
                    avatar: newMessage.author.displayAvatarURL(),
                    author_name: newMessage.author.username,
                    total_members: newMessage.guild.memberCount.toString(),
                    channel: newMessage.channel.toString(),
                    old_content: (oldMessage.content || 'Nessun contenuto').substring(0, 500),
                    new_content: (newMessage.content || 'Nessun contenuto').substring(0, 500)
                };

                await this.sendLogEmbed(
                    this.config.message_log_channel_id,
                    { title: '✏️ Messaggio Modificato', description: '**Autore:** {mention}\n**Canale:** {channel}\n**Prima:** {old_content}\n**Dopo:** {new_content}', color: 0xffa500 },
                    newMessage.guild,
                    variables
                );
            } catch (error) {
                logger.error(`Error in message edit log: ${error.message}`);
            }
        });

        // Member boost
        this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
            try {
                // Check for boost
                if (!oldMember.premiumSince && newMember.premiumSince) {
                    const variables = {
                        mention: newMember.toString(),
                        id: newMember.user.id,
                        avatar: newMember.user.displayAvatarURL(),
                        author_name: newMember.user.username,
                        total_members: newMember.guild.memberCount.toString()
                    };

                    await this.sendLogEmbed(
                        this.config.boost_log_channel_id,
                        { title: '💎 Server Boostato', description: '{mention} ha boostato il server!', color: 0xff69b4, thumbnail: '{avatar}' },
                        newMember.guild,
                        variables
                    );
                }

                // Check for timeout changes
                if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
                    if (newMember.communicationDisabledUntil) {
                        // Member was muted
                        const staffer = await this.getAuditUser(AuditLogEvent.MemberUpdate, newMember.user.id, newMember.guild);
                        const duration = newMember.communicationDisabledUntil ? this.formatTimeDelta(new Date(), newMember.communicationDisabledUntil) : 'Sconosciuto';
                        
                        const variables = {
                            mention: newMember.toString(),
                            id: newMember.user.id,
                            avatar: newMember.user.displayAvatarURL(),
                            author_name: newMember.user.username,
                            total_members: newMember.guild.memberCount.toString(),
                            staffer: staffer,
                            duration: duration,
                            reason: 'Nessuna ragione'
                        };

                        await this.sendLogEmbed(
                            this.config.moderation_log_channel_id,
                            { title: '🔇 Utente Mutato', description: '{mention} è stato mutato\n\n**Moderatore:** {staffer}\n**Durata:** {duration}', color: 0xff0000 },
                            newMember.guild,
                            variables
                        );
                    } else {
                        // Member was unmuted
                        const staffer = await this.getAuditUser(AuditLogEvent.MemberUpdate, newMember.user.id, newMember.guild);
                        
                        const variables = {
                            mention: newMember.toString(),
                            id: newMember.user.id,
                            avatar: newMember.user.displayAvatarURL(),
                            author_name: newMember.user.username,
                            total_members: newMember.guild.memberCount.toString(),
                            staffer: staffer
                        };

                        await this.sendLogEmbed(
                            this.config.moderation_log_channel_id,
                            { title: '🔊 Utente Smutato', description: '{mention} è stato smutato\n\n**Moderatore:** {staffer}', color: 0x00ff00 },
                            newMember.guild,
                            variables
                        );
                    }
                }

                // Check for role changes
                if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
                    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
                    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

                    if (addedRoles.size > 0 || removedRoles.size > 0) {
                        const staffer = await this.getAuditUser(AuditLogEvent.MemberRoleUpdate, newMember.user.id, newMember.guild);
                        const addedStr = addedRoles.size > 0 ? addedRoles.map(r => `<@&${r.id}>`).join(', ') : 'Nessuno';
                        const removedStr = removedRoles.size > 0 ? removedRoles.map(r => `<@&${r.id}>`).join(', ') : 'Nessuno';

                        const variables = {
                            mention: newMember.toString(),
                            id: newMember.user.id,
                            avatar: newMember.user.displayAvatarURL(),
                            author_name: newMember.user.username,
                            total_members: newMember.guild.memberCount.toString(),
                            added_roles: addedStr,
                            removed_roles: removedStr,
                            staffer: staffer
                        };

                        await this.sendLogEmbed(
                            this.config.moderation_log_channel_id,
                            { title: '🏷️ Ruoli Modificati', description: '{mention} ha avuto i ruoli modificati\n\n**Moderatore:** {staffer}\n**Aggiunti:** {added_roles}\n**Rimossi:** {removed_roles}', color: 0x0099ff },
                            newMember.guild,
                            variables
                        );
                    }
                }
            } catch (error) {
                logger.error(`Error in member update log: ${error.message}`);
            }
        });

        // Voice state update
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            try {
                if (!this.config.voice_log_channel_id) return;
                if (oldState.channelId === newState.channelId) return;

                const member = newState.member;
                const variables = {
                    mention: member.toString(),
                    id: member.user.id,
                    avatar: member.user.displayAvatarURL(),
                    author_name: member.user.username,
                    total_members: member.guild.memberCount.toString()
                };

                if (!oldState.channelId && newState.channelId) {
                    // Joined voice channel
                    variables.channel = `<#${newState.channelId}>`;
                    await this.sendLogEmbed(
                        this.config.voice_log_channel_id,
                        { title: '🔊 Entrato in Vocale', description: '{mention} è entrato in {channel}', color: 0x00ff00 },
                        member.guild,
                        variables
                    );
                } else if (oldState.channelId && !newState.channelId) {
                    // Left voice channel
                    variables.channel = `<#${oldState.channelId}>`;
                    await this.sendLogEmbed(
                        this.config.voice_log_channel_id,
                        { title: '🔇 Uscito da Vocale', description: '{mention} è uscito da {channel}', color: 0xff0000 },
                        member.guild,
                        variables
                    );
                } else if (oldState.channelId && newState.channelId) {
                    // Moved between voice channels
                    variables.old_channel = `<#${oldState.channelId}>`;
                    variables.new_channel = `<#${newState.channelId}>`;
                    await this.sendLogEmbed(
                        this.config.voice_log_channel_id,
                        { title: '🔄 Spostato in Vocale', description: '{mention} si è spostato da {old_channel} a {new_channel}', color: 0xffa500 },
                        member.guild,
                        variables
                    );
                }
            } catch (error) {
                logger.error(`Error in voice state log: ${error.message}`);
            }
        });
    }

    async logModeration(guild, action, target, moderator, reason) {
        if (!this.config.moderation_log_channel_id) return;
        
        const channel = guild.channels.cache.get(this.config.moderation_log_channel_id);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Azione di Moderazione: ${action}`)
            .addFields(
                { name: 'Target', value: `${target.tag} (${target.id})`, inline: true },
                { name: 'Moderatore', value: `${moderator.tag} (${moderator.id})`, inline: true },
                { name: 'Motivo', value: reason || 'Nessun motivo specificato', inline: false }
            )
            .setColor(0xff0000)
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    }

    // Ticket logging methods
    async logTicketOpen(member, channel, number, category) {
        const variables = {
            mention: member.toString(),
            id: member.user.id,
            avatar: member.user.displayAvatarURL(),
            author_name: member.user.username,
            total_members: member.guild.memberCount.toString(),
            channel: channel,
            number: number,
            category: category
        };

        await this.sendLogEmbed(
            this.config.ticket_log_channel_id,
            { title: '🎫 Ticket Aperto', description: '{mention} ha aperto il ticket {channel}\n\n**Numero:** #{number}\n**Categoria:** {category}', color: 0x00ff00 },
            member.guild,
            variables
        );
    }

    async logTicketClose(channelName, opener, staffer, number) {
        const variables = {
            name: channelName,
            opener: opener,
            staffer: staffer,
            number: number,
            id: 'N/A'
        };

        await this.sendLogEmbed(
            this.config.ticket_log_channel_id,
            { title: '🔒 Ticket Chiuso', description: 'Ticket **{name}** chiuso\n\n**Aperto da:** {opener}\n**Chiuso da:** {staffer}\n**Numero:** #{number}', color: 0xff0000 },
            null,
            variables
        );
    }

    async logWarn(member, reason, staffer, totalWarns) {
        const variables = {
            mention: member.toString(),
            id: member.user.id,
            avatar: member.user.displayAvatarURL(),
            author_name: member.user.username,
            total_members: member.guild.memberCount.toString(),
            staffer: staffer,
            reason: reason,
            total_warns: totalWarns.toString()
        };

        await this.sendLogEmbed(
            this.config.moderation_log_channel_id,
            { title: '⚠️ Warn Assegnato', description: '{mention} ha ricevuto un warn\n\n**Moderatore:** {staffer}\n**Motivo:** {reason}\n**Warn totali:** {total_warns}', color: 0xffa500 },
            member.guild,
            variables
        );
    }

    async logTicket(guild, action, ticket, user, staff) {
        if (!this.config.ticket_log_channel_id) return;
        
        const channel = guild.channels.cache.get(this.config.ticket_log_channel_id);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket ${action}`)
            .addFields(
                { name: 'Ticket', value: ticket.name || 'Sconosciuto', inline: true },
                { name: 'Utente', value: `${user.tag} (${user.id})`, inline: true }
            )
            .setColor(action === 'Aperto' ? 0x00ff00 : 0xff0000)
            .setTimestamp();

        if (staff) {
            embed.addFields({ name: 'Staff', value: `${staff.tag} (${staff.id})`, inline: true });
        }

        await channel.send({ embeds: [embed] });
    }
}

function setup(client) {
    const logCog = new LogCog(client);
    
    // Make log cog available globally for other cogs
    client.logCog = logCog;
    
    return logCog;
}

module.exports = { setup, LogCog };