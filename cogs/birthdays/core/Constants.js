const EMBED_COLORS = {
    PRIMARY: 0xFF69B4,
    SUCCESS: 0x00FF00,
    ERROR: 0xFF0000,
    WARNING: 0xFFFF00
};

const EMOJIS = {
    CAKE: '🎂',
    PARTY: '🎉',
    GIFT: '🎁',
    BALLOON: '🎈',
    CONFETTI: '🎊',
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️'
};

const DATE_FORMATS = {
    DISPLAY: 'DD/MM',
    STORAGE: 'DD/MM',
    FULL: 'DD/MM/YYYY'
};

const CHECK_INTERVALS = {
    DAILY_CHECK: 60 * 60 * 1000,
    INITIAL_DELAY: 5000
};

const MESSAGES = {
    SET_SUCCESS: 'Il tuo compleanno è stato impostato',
    REMOVE_SUCCESS: 'Il tuo compleanno è stato rimosso',
    NO_BIRTHDAY_SELF: 'Non hai impostato nessun compleanno',
    NO_BIRTHDAY_USER: 'non ha impostato nessun compleanno',
    INVALID_DATE: 'Formato data non valido! Usa il formato DD/MM (es: 15/03)',
    NO_BIRTHDAYS: 'Nessun compleanno registrato',
    ERROR_GENERIC: 'Si è verificato un errore durante l\'esecuzione del comando',
    TODAY_BIRTHDAY: 'Oggi è il compleanno di',
    TOMORROW_BIRTHDAY: 'Il compleanno è domani',
    DAYS_UNTIL: 'tra {days} giorni'
};

const VALIDATION = {
    MIN_DAY: 1,
    MAX_DAY: 31,
    MIN_MONTH: 1,
    MAX_MONTH: 12
};

module.exports = {
    EMBED_COLORS,
    EMOJIS,
    DATE_FORMATS,
    CHECK_INTERVALS,
    MESSAGES,
    VALIDATION
};
