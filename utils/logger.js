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

// === DIRECTORY LOGS (Compatibile Pterodactyl) ===
const logsDir = path.resolve(process.cwd(), '../logs');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// === GENERA NOME BASE (es: 21_Febbraio_2025) ===
const mesi = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const now = new Date();
const baseName = `${now.getDate()}_${mesi[now.getMonth()]}_${now.getFullYear()}`;

// === CONTROLLO VERSIONE SE ESISTE FILE ===
// base: "21_Febbraio_2025.log"
let finalLogName = `${baseName}.log`;
let version = 1;

while (fs.existsSync(path.join(logsDir, finalLogName))) {
    finalLogName = `${baseName}_${version}.log`;
    version++;
}

// === PERCORSO COMPLETO FILE ===
const logFilePath = path.join(logsDir, finalLogName);

// === FORMATI LOG ===
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
    printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} ${level}: ${stack || message}`;
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
            tailable: true
        })
    ]
});

// === LOG IN CONSOLE REALTIME ===
logger.add(new winston.transports.Console({
    level: 'debug',
    format: consoleFormat
}));

// === REDIREZIONE COMPLETA DI console.log ED ERRORI ===
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

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

module.exports = logger;
module.exports.createScopedLogger = (scope) => logger.child({ scope });
