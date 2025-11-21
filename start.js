const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Logger dedicato SOLO per start.js
const startLog = require('./utils/startLogger');

let botProcess = null;
let restartCount = 0;
const maxRestarts = 5;
const restartDelay = 5000; // 5 seconds

function startBot() {
    startLog.log('Starting Valiance Bot...');
    
    botProcess = spawn('node', ['index.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });

    botProcess.on('close', (code) => {
        startLog.log(`Bot process exited with code ${code}`);
        
        if (code !== 0 && restartCount < maxRestarts) {
            restartCount++;
            startLog.log(`Restarting bot (attempt ${restartCount}/${maxRestarts}) in ${restartDelay/1000} seconds...`);
            
            setTimeout(() => {
                startBot();
            }, restartDelay);
        } else if (restartCount >= maxRestarts) {
            startLog.log('Max restart attempts reached. Bot will not restart automatically.');
            process.exit(1);
        } else {
            startLog.log('Bot stopped normally.');
            process.exit(0);
        }
    });

    botProcess.on('error', (error) => {
        startLog.log(`Failed to start bot process: ${error.message}`);
        process.exit(1);
    });

    // Reset restart count after 1 minute of stability
    setTimeout(() => {
        restartCount = 0;
    }, 60000);
}

// Graceful shutdown handling
process.on('SIGINT', () => {
    startLog.log('Received SIGINT, shutting down gracefully...');
    if (botProcess) botProcess.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    startLog.log('Received SIGTERM, shutting down gracefully...');
    if (botProcess) botProcess.kill('SIGTERM');
    process.exit(0);
});

// Required file checks
const requiredFiles = [
    'index.js',
    'config.json',
    '.env',
    'package.json'
];

for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(__dirname, file))) {
        startLog.log(`Required file missing: ${file}`);
        process.exit(1);
    }
}

// Check dependencies
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    startLog.log('node_modules directory not found. Please run "npm install" first.');
    process.exit(1);
}

// Start the bot
startBot();