const Formatters = require('../core/Formatters');

class BanAction {
    constructor(config) {
        this.config = config;
    }

    async execute(message, violationData) {
        const reason = this.buildBanReason(violationData);

        try {
            // Elimina il messaggio offensivo
            try {
                await message.delete();
            } catch (deleteError) {
                // Ignora errori di eliminazione (es. messaggio già cancellato)
            }

            if (this.config.notifyUser) {
                await this.notifyUser(message.author, reason, violationData);
            }

            await message.member.ban({
                reason: reason,
                deleteMessageSeconds: 86400 // Elimina messaggi ultime 24h
            });

            if (this.config.notifyChannel) {
                await this.notifyChannel(message.channel, message.author, reason, violationData);
            }

            return {
                banned: true,
                messageDeleted: true,
                reason: reason,
                notifiedUser: this.config.notifyUser,
                notifiedChannel: this.config.notifyChannel,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                banned: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    buildBanReason(violationData) {
        const parts = ['AI Moderation - Ban Automatico'];

        if (violationData.severity) {
            parts.push(`(${violationData.severity})`);
        }

        if (violationData.analysisResults) {
            const results = violationData.analysisResults;
            const details = [];

            if (results.toxicity && results.toxicity > 0.7) {
                details.push(`Toxicity Critica: ${Formatters.formatScore(results.toxicity)}`);
            }

            if (results.intent && ['phishing', 'scam', 'malicious'].includes(results.intent)) {
                details.push(`Intent Malintenzionato: ${results.intent}`);
            }

            if (details.length > 0) {
                parts.push(details.join(', '));
            }
        }

        return parts.join(' - ');
    }

    async notifyUser(user, reason, violationData) {
        try {
            await user.send({
                content: `🔨 **Sei stato bannato dal server**\n\n` +
                    `**Motivo:** ${reason}\n` +
                    `**Severità:** ${violationData.severity}\n\n` +
                    `Il tuo comportamento ha violato gravemente le regole della community.\n` +
                    `Se ritieni che questo sia un errore, puoi contattare lo staff del server.`
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async notifyChannel(channel, user, reason, violationData) {
        try {
            await channel.send({
                content: `🔨 **Ban Automatico Applicato**\n` +
                    `> **Utente:** ${user.tag} (${user.id})\n` +
                    `> **Motivo:** ${reason}\n` +
                    `> **Severità:** ${violationData.severity}`
            });
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = BanAction;
