const Formatters = require('../core/Formatters');

class TimeoutAction {
    constructor(config) {
        this.config = config;
    }

    async execute(message, violationData) {
        const duration = this.calculateDuration(violationData.severity);

        try {
            // Elimina il messaggio offensivo
            try {
                await message.delete();
            } catch (deleteError) {
                // Ignora errori di eliminazione (es. messaggio già cancellato)
            }

            await message.member.timeout(
                duration,
                this.buildTimeoutReason(violationData)
            );

            if (this.config.notifyUser) {
                await this.notifyUser(message.author, duration, violationData);
            }

            if (this.config.notifyChannel) {
                await this.notifyChannel(message.channel, message.author, duration, violationData);
            }

            return {
                timedOut: true,
                messageDeleted: true,
                duration: duration,
                durationFormatted: Formatters.formatDuration(duration),
                notifiedUser: this.config.notifyUser,
                notifiedChannel: this.config.notifyChannel,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                timedOut: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    calculateDuration(severity) {
        const durations = {
            critical: 24 * 60 * 60 * 1000, // 24 ore
            high: 6 * 60 * 60 * 1000,      // 6 ore
            medium: 1 * 60 * 60 * 1000,    // 1 ora
            low: 10 * 60 * 1000            // 10 minuti
        };

        return durations[severity] || this.config.timeoutDuration || 10 * 60 * 1000;
    }

    buildTimeoutReason(violationData) {
        const parts = ['AI Moderation'];

        if (violationData.severity) {
            parts.push(`(${violationData.severity})`);
        }

        if (violationData.analysisResults) {
            const results = violationData.analysisResults;

            if (results.toxicity && results.toxicity > 0.5) {
                parts.push(`Toxicity: ${Formatters.formatScore(results.toxicity)}`);
            }

            if (results.spam && results.spam > 0.5) {
                parts.push(`Spam: ${Formatters.formatScore(results.spam)}`);
            }
        }

        return parts.join(' - ');
    }

    async notifyUser(user, duration, violationData) {
        try {
            await user.send({
                content: `⚠️ **Timeout Applicato**\n\n` +
                    `Sei stato messo in timeout per **${Formatters.formatDuration(duration)}**.\n` +
                    `**Motivo:** Violazione delle regole della community (${violationData.severity})\n\n` +
                    `Durante il timeout non potrai inviare messaggi o partecipare a canali vocali.\n` +
                    `Per favore, rispetta le regole del server.`
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async notifyChannel(channel, user, duration, violationData) {
        try {
            const notice = await channel.send({
                content: `⏰ **Timeout Applicato**\n` +
                    `> **Utente:** <@${user.id}>\n` +
                    `> **Durata:** ${Formatters.formatDuration(duration)}\n` +
                    `> **Motivo:** Violazione regole (${violationData.severity})`
            });

            setTimeout(async () => {
                try {
                    await notice.delete();
                } catch (err) {
                    // Ignora errori
                }
            }, 10000);

            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = TimeoutAction;
