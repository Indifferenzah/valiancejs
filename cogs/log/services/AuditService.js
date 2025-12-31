const logger = require('../../../utils/logger');

class AuditService {
    static async getEntry(action, targetId, guild) {
        try {
            const logs = await guild.fetchAuditLogs({ type: action, limit: 5 });
            return logs.entries.find(e => e.target?.id === targetId) || logs.entries.first() || null;
        } catch (err) {
            logger.warn(`Impossibile leggere audit log: ${err.message}`);
            return null;
        }
    }

    static async getExecutor(action, targetId, guild) {
        const entry = await this.getEntry(action, targetId, guild);
        return entry?.executor?.tag || 'Sistema';
    }
}

module.exports = AuditService;
