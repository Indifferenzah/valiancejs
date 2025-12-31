const { EMOJIS, MESSAGES } = require('./Constants');

class Formatters {
    static formatDate(day, month) {
        return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
    }

    static formatBirthdayMessage(username, isToday) {
        if (isToday) {
            return `${EMOJIS.PARTY} ${MESSAGES.TODAY_BIRTHDAY} **${username}**! ${EMOJIS.PARTY}`;
        }
        return `${EMOJIS.CAKE} ${username}`;
    }

    static formatDaysUntil(days) {
        if (days === 0) return 'Oggi';
        if (days === 1) return 'Domani';
        return MESSAGES.DAYS_UNTIL.replace('{days}', days);
    }

    static formatBirthdayList(username, dateStr, daysUntil) {
        if (daysUntil === 0) {
            return `${EMOJIS.PARTY} **${username}** - Oggi!`;
        } else if (daysUntil === 1) {
            return `${EMOJIS.CAKE} **${username}** - Domani (${dateStr})`;
        } else {
            return `${EMOJIS.CAKE} **${username}** - ${dateStr} (tra ${daysUntil} giorni)`;
        }
    }

    static formatAnnouncementMessage(user, template) {
        return template
            .replace('{user}', `<@${user.id}>`)
            .replace('{username}', user.username);
    }

    static formatDMMessage(guildName, template) {
        return template.replace('{guild}', guildName);
    }
}

module.exports = Formatters;
