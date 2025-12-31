const Formatters = require('../core/Formatters');

class WarnAction {
    constructor(config, moderationCog) {
        this.config = config;
        this.moderationCog = moderationCog;
    }

    async execute(message, violationData) {
        if (!this.moderationCog) {
            return {
                warned: false,
                error: 'Moderation cog non disponibile',
                timestamp: new Date()
            };
        }

        const reason = this.buildWarnReason(violationData);

        try {
            // Elimina il messaggio offensivo
            try {
                await message.delete();
            } catch (deleteError) {
                // Ignora errori di eliminazione (es. messaggio già cancellato)
            }

            if (typeof this.moderationCog.addWarn === 'function') {
                await this.moderationCog.addWarn(
                    message.author.id,
                    reason,
                    message.client.user.id
                );
            }

            if (this.config.notifyUser) {
                await this.notifyUser(message.author, reason, violationData);
            }

            if (this.config.notifyChannel) {
                await this.notifyChannel(message.channel, message.author, reason, violationData);
            }

            return {
                warned: true,
                messageDeleted: true,
                reason: reason,
                notifiedUser: this.config.notifyUser,
                notifiedChannel: this.config.notifyChannel,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                warned: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    buildWarnReason(violationData) {
        const parts = ['AI Moderation'];

        if (violationData.severity) {
            parts.push(`Severità: ${violationData.severity}`);
        }

        if (violationData.analysisResults) {
            const results = violationData.analysisResults;
            const details = [];

            if (results.toxicity && results.toxicity > 0.3) {
                details.push(`Toxicity ${Formatters.formatScore(results.toxicity)}`);
            }

            if (results.spam && results.spam > 0.3) {
                details.push(`Spam ${Formatters.formatScore(results.spam)}`);
            }

            if (results.intent && results.intent !== 'harmless') {
                details.push(`Intent: ${results.intent}`);
            }

            if (details.length > 0) {
                parts.push(`(${details.join(', ')})`);
            }
        }

        return parts.join(' - ');
    }

    async notifyUser(user, reason, violationData) {
        try {
            await user.send({
                content: `⚠️ **Warning Ricevuto**\n\n` +
                    `Hai ricevuto un warning per violazione delle regole della community.\n` +
                    `**Motivo:** ${reason}\n` +
                    `**Severità:** ${violationData.severity}\n\n` +
                    `Continua a violare le regole potrebbe portare a sanzioni più severe (timeout, ban).\n` +
                    `Ti preghiamo di rispettare le regole del server.`
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async notifyChannel(channel, user, reason, violationData) {
        try {
            const notice = await channel.send({
                content: `⚠️ **Warning Applicato**\n` +
                    `> **Utente:** <@${user.id}>\n` +
                    `> **Motivo:** ${reason}\n` +
                    `> **Severità:** ${violationData.severity}`
            });

            setTimeout(async () => {
                try {
                    await notice.delete();
                } catch (err) {
                    // Ignora errori
                }
            }, 8000);

            return true;
        } catch (error) {
            return false;
        }
    }

    setModerationCog(moderationCog) {
        this.moderationCog = moderationCog;
    }
}

module.exports = WarnAction;
