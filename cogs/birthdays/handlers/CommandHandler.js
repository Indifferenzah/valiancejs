const { EmbedBuilder } = require('discord.js');
const logger = require('../../../utils/logger');
const { EMBED_COLORS, EMOJIS, MESSAGES } = require('../core/Constants');
const Formatters = require('../core/Formatters');

class CommandHandler {
    constructor(birthdayService) {
        this.birthdayService = birthdayService;
    }

    async handleSet(interaction) {
        const dateStr = interaction.options.getString('date');
        const parsed = this.birthdayService.parseDate(dateStr);

        if (!parsed) {
            await interaction.reply({
                content: `${EMOJIS.ERROR} ${MESSAGES.INVALID_DATE}`,
                ephemeral: true
            });
            return;
        }

        const userId = interaction.user.id;
        this.birthdayService.setBirthday(
            userId,
            parsed.day,
            parsed.month,
            interaction.user.username
        );

        const dateFormatted = Formatters.formatDate(parsed.day, parsed.month);

        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.CAKE} Compleanno Impostato`)
            .setDescription(`${MESSAGES.SET_SUCCESS} al **${dateFormatted}**`)
            .setColor(EMBED_COLORS.SUCCESS)
            .setFooter({ text: 'Valiance Bot | Sistema Compleanni' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async handleRemove(interaction) {
        const userId = interaction.user.id;

        if (!this.birthdayService.getBirthday(userId)) {
            await interaction.reply({
                content: `${EMOJIS.ERROR} ${MESSAGES.NO_BIRTHDAY_SELF}!`,
                ephemeral: true
            });
            return;
        }

        this.birthdayService.removeBirthday(userId);

        await interaction.reply({
            content: `${EMOJIS.SUCCESS} ${MESSAGES.REMOVE_SUCCESS}!`,
            ephemeral: true
        });
    }

    async handleWhen(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const birthday = this.birthdayService.getBirthday(user.id);

        if (!birthday) {
            const message = user.id === interaction.user.id
                ? MESSAGES.NO_BIRTHDAY_SELF
                : `${user.username} ${MESSAGES.NO_BIRTHDAY_USER}`;

            await interaction.reply({
                content: `${EMOJIS.ERROR} ${message}!`,
                ephemeral: true
            });
            return;
        }

        const daysUntil = this.birthdayService.getDaysUntilBirthday(
            birthday.day,
            birthday.month
        );
        const dateStr = Formatters.formatDate(birthday.day, birthday.month);

        let description;
        if (daysUntil === 0) {
            description = `${EMOJIS.PARTY} **${MESSAGES.TODAY_BIRTHDAY} ${user.username}!** ${EMOJIS.PARTY}`;
        } else if (daysUntil === 1) {
            description = `${EMOJIS.CAKE} Il compleanno di ${user.username} è **domani** (${dateStr})!`;
        } else {
            description = `${EMOJIS.CAKE} Il compleanno di ${user.username} è il **${dateStr}** (tra ${daysUntil} giorni)`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.CAKE} Compleanno`)
            .setDescription(description)
            .setColor(EMBED_COLORS.PRIMARY)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Valiance Bot | Sistema Compleanni' });

        await interaction.reply({ embeds: [embed] });
    }

    async handleNext(interaction) {
        const upcomingBirthdays = this.birthdayService.getUpcomingBirthdays(10);

        if (upcomingBirthdays.length === 0) {
            await interaction.reply({
                content: `${EMOJIS.ERROR} ${MESSAGES.NO_BIRTHDAYS}!`,
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.CAKE} Prossimi Compleanni`)
            .setColor(EMBED_COLORS.PRIMARY)
            .setFooter({ text: 'Valiance Bot | Sistema Compleanni' });

        let description = '';
        for (const birthday of upcomingBirthdays) {
            const dateStr = Formatters.formatDate(birthday.day, birthday.month);
            const user = await interaction.client.users.fetch(birthday.userId).catch(() => null);
            const username = user ? user.username : birthday.username;

            description += Formatters.formatBirthdayList(
                username,
                dateStr,
                birthday.daysUntil
            ) + '\n';
        }

        embed.setDescription(description);
        await interaction.reply({ embeds: [embed] });
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'set':
                    await this.handleSet(interaction);
                    break;
                case 'remove':
                    await this.handleRemove(interaction);
                    break;
                case 'when':
                    await this.handleWhen(interaction);
                    break;
                case 'next':
                    await this.handleNext(interaction);
                    break;
            }
        } catch (error) {
            logger.error(`[BIRTHDAYS] Errore comando ${subcommand}: ${error.message}`);

            const errorMessage = `${EMOJIS.ERROR} ${MESSAGES.ERROR_GENERIC}`;

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }
}

module.exports = CommandHandler;
