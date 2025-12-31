const { loadJsonSync, saveJsonSync } = require('../../../utils/jsonStore');
const logger = require('../../../utils/logger');
const path = require('path');
const { VALIDATION } = require('../core/Constants');
const Formatters = require('../core/Formatters');

class BirthdayService {
    constructor(dataPath) {
        this.dataPath = dataPath;
        this.birthdays = this.loadBirthdays();
    }

    loadBirthdays() {
        try {
            return loadJsonSync(this.dataPath, {});
        } catch (error) {
            logger.error(`[BIRTHDAYS] Errore caricamento dati: ${error.message}`);
            return {};
        }
    }

    saveBirthdays() {
        try {
            saveJsonSync(this.dataPath, this.birthdays);
        } catch (error) {
            logger.error(`[BIRTHDAYS] Errore salvataggio dati: ${error.message}`);
        }
    }

    parseDate(dateStr) {
        const parts = dateStr.split('/');
        if (parts.length !== 2) return null;

        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);

        if (
            isNaN(day) || 
            isNaN(month) || 
            day < VALIDATION.MIN_DAY || 
            day > VALIDATION.MAX_DAY || 
            month < VALIDATION.MIN_MONTH || 
            month > VALIDATION.MAX_MONTH
        ) {
            return null;
        }

        return { day, month };
    }

    setBirthday(userId, day, month, username) {
        this.birthdays[userId] = {
            day,
            month,
            username,
            setAt: new Date().toISOString()
        };
        this.saveBirthdays();
        logger.info(`[BIRTHDAYS] Compleanno impostato per ${username}: ${Formatters.formatDate(day, month)}`);
        return true;
    }

    removeBirthday(userId) {
        if (!this.birthdays[userId]) {
            return false;
        }
        delete this.birthdays[userId];
        this.saveBirthdays();
        logger.info(`[BIRTHDAYS] Compleanno rimosso per user ${userId}`);
        return true;
    }

    getBirthday(userId) {
        return this.birthdays[userId] || null;
    }

    getAllBirthdays() {
        return Object.entries(this.birthdays).map(([userId, data]) => ({
            userId,
            ...data
        }));
    }

    getDaysUntilBirthday(day, month) {
        const now = new Date();
        const currentYear = now.getFullYear();
        let birthday = new Date(currentYear, month - 1, day);

        if (birthday < now) {
            birthday = new Date(currentYear + 1, month - 1, day);
        }

        const diffTime = birthday - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getTodaysBirthdays() {
        const now = new Date();
        const today = now.getDate();
        const currentMonth = now.getMonth() + 1;

        return this.getAllBirthdays().filter(
            birthday => birthday.day === today && birthday.month === currentMonth
        );
    }

    getUpcomingBirthdays(limit = 10) {
        return this.getAllBirthdays()
            .map(birthday => ({
                ...birthday,
                daysUntil: this.getDaysUntilBirthday(birthday.day, birthday.month)
            }))
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .slice(0, limit);
    }

    getBirthdayCount() {
        return Object.keys(this.birthdays).length;
    }

    isTodayBirthday(day, month) {
        const now = new Date();
        return now.getDate() === day && (now.getMonth() + 1) === month;
    }
}

module.exports = BirthdayService;
