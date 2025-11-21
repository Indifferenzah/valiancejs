const fs = require('fs');
const path = require('path');

const mesi = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

// Directory che diventa:  /home/container/../startlogs
// Quindi:                 /home/startlogs   (se Pterodactyl lo permette)
// oppure                 /yourproject/startlogs (in locale)
const logsDir = path.resolve(process.cwd(), '../startlogs');

// Crea la cartella se non esiste
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Nome base tipo: start_21_Febbraio_2025
const now = new Date();
const baseName = `start_${now.getDate()}_${mesi[now.getMonth()]}_${now.getFullYear()}`;

let finalName = `${baseName}.log`;
let version = 1;

// Versioning: start_21_Feb_2025.log → _1 → _2 → ...
while (fs.existsSync(path.join(logsDir, finalName))) {
    finalName = `${baseName}_${version}.log`;
    version++;
}

const logFile = path.join(logsDir, finalName);
const stream = fs.createWriteStream(logFile, { flags: 'a' });

// Logger minimale ma perfetto per start.js
function log(msg) {
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const formatted = `[STARTJS ${timestamp}] ${msg}\n`;

    stream.write(formatted);
    console.log(formatted.trim());
}

module.exports = { log };
