const { EmbedBuilder } = require('discord.js');
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
            boost_log_channel_id: ""
        });
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    reloadConfig() {
        this.config = this.loadConfig();
        logger.info('Log config reloaded');
    }

    setupEventListeners() {
        // Member join
        this.client.on('guildMemberAdd', async (member) => {
            if (!this.config.join_log_channel_id) return;
            
            const channel = member.guild.channels.cache.get(this.config.join_log_channel_id);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('📥 Membro Entrato')
                .setDescription(`${member.user.tag} è entrato nel server`)
                .addFields(
                    { name: 'Utente', value: `${member.user.toString()} (${member.user.id})`, inline: true },
                    { name: 'Account creato', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setColor(0x00ff00)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        });

        // Member leave
        this.client.on('guildMemberRemove', async (member) => {
            if (!this.config.leave_log_channel_id) return;
            
            const channel = member.guild.channels.cache.get(this.config.leave_log_channel_id);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('📤 Membro Uscito')
                .setDescription(`${member.user.tag} ha lasciato il server`)
                .addFields(
                    { name: 'Utente', value: `${member.user.toString()} (${member.user.id})`, inline: true },
                    { name: 'Entrato', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Sconosciuto', inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setColor(0xff0000)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        });

        // Message delete
        this.client.on('messageDelete', async (message) => {
            if (!this.config.message_log_channel_id || !message.guild || message.author?.bot) return;
            
            const channel = message.guild.channels.cache.get(this.config.message_log_channel_id);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Messaggio Eliminato')
                .addFields(
                    { name: 'Autore', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Sconosciuto', inline: true },
                    { name: 'Canale', value: `${message.channel.toString()} (${message.channel.id})`, inline: true },
                    { name: 'Contenuto', value: message.content || '*Nessun contenuto testuale*', inline: false }
                )
                .setColor(0xff0000)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        });

        // Message edit
        this.client.on('messageUpdate', async (oldMessage, newMessage) => {
            if (!this.config.message_log_channel_id || !newMessage.guild || newMessage.author?.bot) return;
            if (oldMessage.content === newMessage.content) return;
            
            const channel = newMessage.guild.channels.cache.get(this.config.message_log_channel_id);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('✏️ Messaggio Modificato')
                .addFields(
                    { name: 'Autore', value: `${newMessage.author.tag} (${newMessage.author.id})`, inline: true },
                    { name: 'Canale', value: `${newMessage.channel.toString()} (${newMessage.channel.id})`, inline: true },
                    { name: 'Prima', value: oldMessage.content || '*Nessun contenuto*', inline: false },
                    { name: 'Dopo', value: newMessage.content || '*Nessun contenuto*', inline: false }
                )
                .setColor(0xffa500)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        });

        // Member boost
        this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
            if (!this.config.boost_log_channel_id) return;
            if (oldMember.premiumSince || !newMember.premiumSince) return;
            
            const channel = newMember.guild.channels.cache.get(this.config.boost_log_channel_id);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('💎 Server Boostato')
                .setDescription(`${newMember.user.tag} ha boostato il server!`)
                .addFields(
                    { name: 'Utente', value: `${newMember.user.toString()} (${newMember.user.id})`, inline: true },
                    { name: 'Boost Level', value: newMember.guild.premiumTier.toString(), inline: true },
                    { name: 'Boost Count', value: newMember.guild.premiumSubscriptionCount.toString(), inline: true }
                )
                .setThumbnail(newMember.user.displayAvatarURL())
                .setColor(0xff69b4)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
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
    return logCog;
}

module.exports = { setup, LogCog };