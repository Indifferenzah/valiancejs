const { EmbedBuilder } = require('discord.js');
const logger = require('../../../utils/logger');
const { EMBED_COLORS, EMOJIS } = require('../core/Constants');
const Formatters = require('../core/Formatters');

class NotificationService {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    updateConfig(config) {
        this.config = config;
    }

    async sendBirthdayAnnouncement(guild, birthday) {
        const notificationConfig = this.config.notifications;

        if (!notificationConfig.enabled || !notificationConfig.channelId) {
            logger.warn('[BIRTHDAYS] Notifiche disabilitate o canale non configurato');
            return false;
        }

        try {
            const channel = await guild.channels.fetch(notificationConfig.channelId);
            if (!channel || !channel.isTextBased()) {
                logger.error('[BIRTHDAYS] Canale notifiche non valido');
                return false;
            }

            const user = await this.client.users.fetch(birthday.userId).catch(() => null);
            if (!user) {
                logger.warn(`[BIRTHDAYS] Utente ${birthday.userId} non trovato`);
                return false;
            }

            if (notificationConfig.useEmbed) {
                await this.sendEmbedAnnouncement(channel, user, notificationConfig);
            } else {
                await this.sendTextAnnouncement(channel, user, notificationConfig);
            }

            await this.sendDMBirthday(user, guild);

            logger.info(`[BIRTHDAYS] Annuncio compleanno inviato per ${user.username}`);
            return true;

        } catch (error) {
            logger.error(`[BIRTHDAYS] Errore invio annuncio: ${error.message}`);
            return false;
        }
    }

    async sendEmbedAnnouncement(channel, user, notificationConfig) {
        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.PARTY} BUON COMPLEANNO! ${EMOJIS.PARTY}`)
            .setDescription(
                Formatters.formatAnnouncementMessage(
                    user,
                    this.config.messages.birthday
                )
            )
            .setColor(EMBED_COLORS.PRIMARY)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp()
            .setFooter({ text: 'Valiance Bot | Sistema Compleanni' });

        const messageOptions = { embeds: [embed] };

        if (notificationConfig.roleId) {
            messageOptions.content = `<@&${notificationConfig.roleId}>`;
        }

        await channel.send(messageOptions);
    }

    async sendTextAnnouncement(channel, user, notificationConfig) {
        let content = Formatters.formatAnnouncementMessage(
            user,
            this.config.messages.birthday
        );

        if (notificationConfig.roleId) {
            content = `<@&${notificationConfig.roleId}>\n${content}`;
        }

        await channel.send(content);
    }

    async sendDMBirthday(user, guild) {
        try {
            const dmMessage = Formatters.formatDMMessage(
                guild.name,
                this.config.messages.dmBirthday
            );

            await user.send(dmMessage);
            logger.info(`[BIRTHDAYS] DM compleanno inviato a ${user.username}`);
        } catch (error) {
            logger.warn(`[BIRTHDAYS] Impossibile inviare DM a ${user.username}: ${error.message}`);
        }
    }

    async sendMultipleBirthdayAnnouncements(guild, birthdays) {
        const results = [];

        for (const birthday of birthdays) {
            const result = await this.sendBirthdayAnnouncement(guild, birthday);
            results.push({ userId: birthday.userId, success: result });
        }

        return results;
    }
}

module.exports = NotificationService;
