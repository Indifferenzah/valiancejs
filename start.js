const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logger = require('./utils/logger');

let botProcess = null;
let restartCount = 0;
const maxRestarts = 5;
const restartDelay = 5000; // 5 seconds

function startBot() {
    logger.info('Starting Valiance Bot...');
    
    botProcess = spawn('node', ['index.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });

    botProcess.on('close', (code) => {
        logger.info(`Bot process exited with code ${code}`);
        
        if (code !== 0 && restartCount < maxRestarts) {
            restartCount++;
            logger.warn(`Restarting bot (attempt ${restartCount}/${maxRestarts}) in ${restartDelay/1000} seconds...`);
            
            setTimeout(() => {
                startBot();
            }, restartDelay);
        } else if (restartCount >= maxRestarts) {
            logger.error('Max restart attempts reached. Bot will not restart automatically.');
            process.exit(1);
        } else {
            logger.info('Bot stopped normally.');
            process.exit(0);
        }
    });

    botProcess.on('error', (error) => {
        logger.error(`Failed to start bot process: ${error.message}`);
        process.exit(1);
    });

    // Reset restart count on successful start
    setTimeout(() => {
        restartCount = 0;
    }, 60000); // Reset after 1 minute of successful running
}

// Handle process termination
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    if (botProcess) {
        botProcess.kill('SIGINT');
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    if (botProcess) {
        botProcess.kill('SIGTERM');
    }
    process.exit(0);
});

// Check if required files exist
const requiredFiles = [
    'index.js',
    'config.json',
    '.env',
    'package.json'
];

for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(__dirname, file))) {
        logger.error(`Required file missing: ${file}`);
        process.exit(1);
    }
}

// Check if node_modules exists
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    logger.error('node_modules directory not found. Please run "npm install" first.');
    process.exit(1);
}

// Start the bot
startBot();