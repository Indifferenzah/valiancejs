const logger = require('../../../utils/logger');
const { CHECK_INTERVALS } = require('../core/Constants');

class SchedulerService {
    constructor(client, birthdayService, notificationService, configManager) {
        this.client = client;
        this.birthdayService = birthdayService;
        this.notificationService = notificationService;
        this.configManager = configManager;
        this.checkTimer = null;
        this.lastCheckDate = null;
    }

    start() {
        logger.info('[BIRTHDAYS] Avvio scheduler compleanni');
        
        setTimeout(() => {
            this.performDailyCheck();
        }, CHECK_INTERVALS.INITIAL_DELAY);

        this.checkTimer = setInterval(() => {
            this.performDailyCheck();
        }, CHECK_INTERVALS.DAILY_CHECK);

        logger.info('[BIRTHDAYS] Scheduler avviato con successo');
    }

    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
            logger.info('[BIRTHDAYS] Scheduler fermato');
        }
    }

    async performDailyCheck() {
        if (!this.configManager.isEnabled()) {
            return;
        }

        const today = new Date().toDateString();
        
        if (this.lastCheckDate === today) {
            return;
        }

        this.lastCheckDate = today;

        logger.info('[BIRTHDAYS] Esecuzione controllo giornaliero compleanni');

        try {
            const todaysBirthdays = this.birthdayService.getTodaysBirthdays();

            if (todaysBirthdays.length === 0) {
                logger.info('[BIRTHDAYS] Nessun compleanno oggi');
                return;
            }

            logger.info(`[BIRTHDAYS] Trovati ${todaysBirthdays.length} compleanni oggi`);

            for (const guild of this.client.guilds.cache.values()) {
                await this.processGuildBirthdays(guild, todaysBirthdays);
            }

        } catch (error) {
            logger.error(`[BIRTHDAYS] Errore durante controllo giornaliero: ${error.message}`);
        }
    }

    async processGuildBirthdays(guild, birthdays) {
        try {
            const guildBirthdays = [];

            for (const birthday of birthdays) {
                const member = await guild.members.fetch(birthday.userId).catch(() => null);
                if (member) {
                    guildBirthdays.push(birthday);
                }
            }

            if (guildBirthdays.length === 0) {
                return;
            }

            logger.info(`[BIRTHDAYS] Elaborazione ${guildBirthdays.length} compleanni per ${guild.name}`);

            await this.notificationService.sendMultipleBirthdayAnnouncements(
                guild,
                guildBirthdays
            );

        } catch (error) {
            logger.error(`[BIRTHDAYS] Errore elaborazione compleanni per ${guild.name}: ${error.message}`);
        }
    }

    async forceCheck() {
        this.lastCheckDate = null;
        await this.performDailyCheck();
    }

    getStatus() {
        return {
            running: this.checkTimer !== null,
            lastCheck: this.lastCheckDate,
            nextCheck: this.checkTimer ? 'In programma' : 'Non programmato'
        };
    }
}

module.exports = SchedulerService;
