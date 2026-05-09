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

// === DIRECTORY LOGS ===
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// === NOME FILE FORMATTATO ===
const mesi = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const now = new Date();
const nomeFile = `${now.getDate()}_${mesi[now.getMonth()]}_${now.getFullYear()}.log`;
const logFilePath = path.join(logsDir, nomeFile);

// === FORMATS ===
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
    printf(({ timestamp, level, message, stack, service = 'valiance-bot', pid = process.pid }) => {
        return `${timestamp} ${level}: [${service}@${pid}] ${stack || message}`;
    })
);

// === LOGGER ===
const logger = winston.createLogger({
    level: 'debug',
    format: fileFormat,
    defaultMeta: { service: 'valiance-bot', pid: process.pid },
    transports: [
        new winston.transports.File({
            filename: logFilePath,
            level: 'debug',
            maxsize: 20 * 1024 * 1024,
            tailable: true
        })
    ],
    exitOnError: false
});

// === OUTPUT IN CONSOLE REALTIME ===
logger.add(new winston.transports.Console({
    level: 'debug',
    format: consoleFormat
}));

// === REDIREZIONE console.log / console.error ===
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Sovrascrivo le funzioni della console
const origLog = console.log;
const origErr = console.error;

console.log = (...args) => {
    logStream.write(`[LOG] ${args.join(' ')}\n`);
    origLog.apply(console, args);
};

console.error = (...args) => {
    logStream.write(`[ERROR] ${args.join(' ')}\n`);
    origErr.apply(console, args);
};

// === EXPORT ===
module.exports = logger;
module.exports.createScopedLogger = (scope) => logger.child({ scope });
