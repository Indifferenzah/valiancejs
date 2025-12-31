const Formatters = require('../core/Formatters');

class DeleteAction {
    constructor(config) {
        this.config = config;
    }

    async execute(message, violationData) {
        try {
            await message.delete();

            if (this.config.notifyChannel) {
                await this.sendNotification(message, violationData);
            }

            return {
                deleted: true,
                notified: this.config.notifyChannel,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                deleted: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    async sendNotification(message, violationData) {
        const safeContent = Formatters.sanitizeMentions(violationData.content);
        const truncated = Formatters.truncateText(safeContent, 500);

        const notificationContent = this.buildNotificationMessage(
            message.author,
            truncated,
            violationData
        );

        try {
            const notice = await message.channel.send(notificationContent);

            setTimeout(async () => {
                try {
                    await notice.delete();
                } catch (err) {
                    // Ignora errori di eliminazione
                }
            }, 5000);

            return true;
        } catch (error) {
            return false;
        }
    }

    buildNotificationMessage(author, content, violationData) {
        const severity = violationData.severity || 'unknown';
        const icon = this.getSeverityIcon(severity);

        return {
            content: `${icon} **Contenuto Rimosso**\n` +
                `> **Autore:** <@${author.id}>\n` +
                `> **Motivo:** Violazione regole (${severity})\n` +
                `> **Messaggio:** ${content || '*contenuto vuoto*'}`
        };
    }

    getSeverityIcon(severity) {
        const icons = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢',
            none: 'ℹ️'
        };

        return icons[severity] || 'ℹ️';
    }
}

module.exports = DeleteAction;
