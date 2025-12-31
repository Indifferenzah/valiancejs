const { EmbedBuilder } = require('discord.js');
const Formatters = require('../core/Formatters');
const logger = require('../../../utils/logger');

class EmbedService {
    constructor(webhookService) {
        this.webhookService = webhookService;
    }

    buildEmbed(embedConfig, user, variables) {
        const title = Formatters.renderTemplate(embedConfig.title || '', variables);
        const description = Formatters.renderTemplate(embedConfig.description || '', variables);

        const embed = new EmbedBuilder()
            .setColor(embedConfig.color || 0x00ff00)
            .setTimestamp();

        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description);

        if (embedConfig.thumbnail) {
            const thumbnail = Formatters.renderTemplate(embedConfig.thumbnail, variables);
            if (thumbnail) embed.setThumbnail(thumbnail);
        }

        if (embedConfig.footer) {
            const footer = Formatters.renderTemplate(embedConfig.footer, variables);
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

        return embed;
    }

    async send(target, embedConfig, client, user = null, variables = {}) {
        try {
            if (!target || !embedConfig) return;

            const resolved = this.webhookService.resolve(target, client);
            if (!resolved) return;

            const embed = this.buildEmbed(embedConfig, user, variables);
            const payload = { embeds: [embed] };

            await this.webhookService.send(resolved, payload);
        } catch (error) {
            logger.error(`Errore nell'invio del log: ${error.message}`);
        }
    }
}

module.exports = EmbedService;
