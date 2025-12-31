const { ChannelType } = require('discord.js');

class Formatters {
    static formatDateTime(date) {
        if (!date) return 'Sconosciuto';
        return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
    }

    static formatTimeDelta(start, end) {
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

    static getRolesString(member) {
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

    static renderTemplate(template, variables) {
        if (!template) return '';
        let result = template;
        for (const [key, value] of Object.entries(variables || {})) {
            const safeValue = value !== undefined && value !== null ? String(value) : '';
            result = result.replace(new RegExp(`{${key}}`, 'g'), safeValue);
        }
        return result;
    }

    static channelTypeToString(type) {
        const types = {
            [ChannelType.GuildText]: 'Testo',
            [ChannelType.GuildVoice]: 'Vocale',
            [ChannelType.GuildCategory]: 'Categoria',
            [ChannelType.GuildNews]: 'Annunci',
            [ChannelType.GuildStageVoice]: 'Stage',
            [ChannelType.GuildForum]: 'Forum',
            [ChannelType.PublicThread]: 'Thread',
            [ChannelType.PrivateThread]: 'Thread',
            [ChannelType.AnnouncementThread]: 'Thread'
        };
        return types[type] || 'Sconosciuto';
    }

    static formatAuditChanges(auditEntry) {
        if (!auditEntry || !auditEntry.changes) return 'Nessun dettaglio disponibile.';
        const parts = [];
        for (const change of auditEntry.changes) {
            const key = change.key;
            const oldVal = change.old ?? 'N/A';
            const newVal = change.new ?? 'N/A';
            parts.push(`\`${key}\`: \`${oldVal}\` → \`${newVal}\``);
        }
        return parts.join('\n').slice(0, 1000) || 'Nessun dettaglio disponibile.';
    }
}

module.exports = Formatters;
