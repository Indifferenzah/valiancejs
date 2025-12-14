const winston = require('winston');
const path = require('path');
const fs = require('fs');

const {
    combine,
    timestamp,
    errors,
    json,
    colorize,
    printf,
    splat,
    metadata
} = winston.format;

/* =======================
   DIRECTORY LOGS
======================= */
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/* =======================
   FILE NAMES
======================= */
const date = new Date().toISOString().split('T')[0];

const files = {
    all: path.join(logsDir, `${date}.log`),
    error: path.join(logsDir, `${date}.error.log`)
};

/* =======================
   CUSTOM LEVELS
======================= */
const levels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        discord: 3,
        debug: 4,
        trace: 5
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        discord: 'magenta',
        debug: 'cyan',
        trace: 'grey'
    }
};


winston.addColors(levels.colors);

/* =======================
   FORMATS
======================= */
const baseFormat = combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
    splat(),
    metadata({ fillExcept: ['timestamp', 'level', 'message', 'stack'] })
);

const fileFormat = combine(
    baseFormat,
    json()
);

const consoleFormat = combine(
    colorize({ all: true }),
    baseFormat,
    printf(({ timestamp, level, message, stack, scope, service, pid }) => {
        const scopeLabel = scope ? `${scope} ` : '';
        return `${timestamp} ${level}: ${scopeLabel}[${service}@${pid}] ${stack || message}`;
    })
);

/* =======================
   LOGGER INSTANCE
======================= */
const logger = winston.createLogger({
    levels: levels.levels,
    level: process.env.LOG_LEVEL || 'debug',
    defaultMeta: {
        service: 'valiance-bot',
        pid: process.pid
    },
    transports: [
        // Tutto
        new winston.transports.File({
            filename: files.all,
            format: fileFormat,
            maxsize: 25 * 1024 * 1024,
            maxFiles: 14,
            tailable: true
        }),

        // Solo errori
        new winston.transports.File({
            filename: files.error,
            level: 'error',
            format: fileFormat,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 30,
            tailable: true
        })
    ],
    exitOnError: false
});

/* =======================
   CONSOLE OUTPUT
======================= */
logger.add(new winston.transports.Console({
    level: process.env.LOG_CONSOLE_LEVEL || 'debug',
    format: consoleFormat
}));

/* =======================
   SAFE console.* BRIDGE
======================= */
console.log = (...args) => logger.info(args.join(' '));
console.warn = (...args) => logger.warn(args.join(' '));
console.error = (...args) => logger.error(args.join(' '));

/* =======================
   SCOPED LOGGER
======================= */
function createScopedLogger(scope) {
    return logger.child({ scope });
}

module.exports = logger;
module.exports.createScopedLogger = createScopedLogger;
