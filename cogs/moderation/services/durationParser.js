const { DURATION_UNITS, MAX_TIMEOUT_DURATION, DEFAULT_TIMEOUT_DURATION } = require('../constants');
const logger = require('../../../utils/logger');

function parseDuration(duration) {
    if (!duration || typeof duration !== 'string') {
        logger.warn('[DURATION_PARSER] Invalid duration input, using default.');
        return parseDuration(DEFAULT_TIMEOUT_DURATION);
    }

    const match = duration.trim().match(/^(\d+)([smhd])$/i);
    
    if (!match) {
        logger.warn(`[DURATION_PARSER] Invalid duration format: ${duration}, using default.`);
        return parseDuration(DEFAULT_TIMEOUT_DURATION);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (value <= 0) {
        logger.warn(`[DURATION_PARSER] Invalid duration value: ${value}, using default.`);
        return parseDuration(DEFAULT_TIMEOUT_DURATION);
    }

    const multiplier = DURATION_UNITS[unit];
    
    if (!multiplier) {
        logger.warn(`[DURATION_PARSER] Unknown duration unit: ${unit}, using default.`);
        return parseDuration(DEFAULT_TIMEOUT_DURATION);
    }

    const milliseconds = value * multiplier;

    if (milliseconds > MAX_TIMEOUT_DURATION) {
        logger.warn(`[DURATION_PARSER] Duration ${duration} exceeds Discord limit, capping to 28 days.`);
        return MAX_TIMEOUT_DURATION;
    }

    return milliseconds;
}

function formatDuration(ms) {
    if (typeof ms !== 'number' || ms < 0) {
        return 'Durata sconosciuta';
    }

    const units = [
        { name: 'giorno', value: DURATION_UNITS.d },
        { name: 'ora', value: DURATION_UNITS.h },
        { name: 'minuto', value: DURATION_UNITS.m },
        { name: 'secondo', value: DURATION_UNITS.s }
    ];

    for (const unit of units) {
        if (ms >= unit.value) {
            const count = Math.floor(ms / unit.value);
            const remainder = ms % unit.value;
            
            let result = `${count} ${unit.name}${count !== 1 ? 's' : ''}`;
            
            if (remainder > 0 && remainder >= DURATION_UNITS.m) {
                const nextUnit = units.find(u => remainder >= u.value);
                if (nextUnit) {
                    const nextCount = Math.floor(remainder / nextUnit.value);
                    result += ` ${nextCount} ${nextUnit.name}${nextCount !== 1 ? 's' : ''}`;
                }
            }
            
            return result;
        }
    }

    return 'Meno di 1 secondo';
}

function isValidDuration(duration) {
    if (!duration || typeof duration !== 'string') {
        return false;
    }

    return /^\d+[smhd]$/i.test(duration.trim());
}

function getUnitName(unit) {
    const unitNames = {
        s: 'second',
        m: 'minute',
        h: 'hour',
        d: 'day'
    };

    return unitNames[unit.toLowerCase()] || 'unknown';
}

module.exports = {
    parseDuration,
    formatDuration,
    isValidDuration,
    getUnitName
};
