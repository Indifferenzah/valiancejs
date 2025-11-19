const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'valiance-bot' },
    transports: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'errors.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(logsDir, `bot_${new Date().toISOString().split('T')[0]}.log`) 
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

module.exports = logger;