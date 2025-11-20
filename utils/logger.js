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

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const toNumberOrDefault = (value, defaultValue) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
};

const logLevel = process.env.LOG_LEVEL || 'info';
const fileLevel = process.env.LOG_FILE_LEVEL || logLevel;
const consoleLevel = process.env.LOG_CONSOLE_LEVEL || logLevel;
const maxSize = toNumberOrDefault(process.env.LOG_MAX_SIZE, 5 * 1024 * 1024); // 5 MB
const maxFiles = toNumberOrDefault(process.env.LOG_MAX_FILES, 7);
const serviceName = process.env.LOG_SERVICE_NAME || 'valiance-bot';
const logToConsole = process.env.LOG_TO_CONSOLE === 'true' || process.env.NODE_ENV !== 'production';

const fileFormat = combine(
    timestamp(),
    errors({ stack: true }),
    splat(),
    metadata({ fillExcept: ['timestamp', 'level', 'message', 'stack'] }),
    json()
);

const consoleFormat = combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    splat(),
    metadata({ fillExcept: ['timestamp', 'level', 'message', 'stack'] }),
    printf(({ timestamp, level, message, stack, service, pid, metadata: meta = {} }) => {
        const scope = meta.scope ? `[${meta.scope}] ` : '';
        const baseMeta = { ...meta };
        delete baseMeta.scope;
        const metaString = Object.keys(baseMeta).length ? ` ${JSON.stringify(baseMeta)}` : '';

        return `${timestamp} ${level}: [${service || serviceName}@${pid || process.pid}] ${scope}${stack || message}${metaString}`;
    })
);

const logger = winston.createLogger({
    level: logLevel,
    format: fileFormat,
    defaultMeta: { service: serviceName, pid: process.pid },
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'errors.log'),
            level: 'error',
            maxsize: maxSize,
            maxFiles,
            tailable: true
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'bot.log'),
            level: fileLevel,
            maxsize: maxSize,
            maxFiles,
            tailable: true
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: maxSize,
            maxFiles,
            tailable: true
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: maxSize,
            maxFiles,
            tailable: true
        })
    ],
    exitOnError: false
});

if (logToConsole) {
    logger.add(new winston.transports.Console({
        level: consoleLevel,
        format: consoleFormat
    }));
}

const createScopedLogger = (scope) => logger.child({ scope });

module.exports = logger;
module.exports.createScopedLogger = createScopedLogger;
