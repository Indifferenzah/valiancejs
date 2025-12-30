const fs = require('fs');
const path = require('path');

let config = null;

/**
 * Carica o ricarica la configurazione dal file config.json
 * @returns {Object} Oggetto di configurazione
 */
function loadConfig() {
    const configPath = path.join(process.cwd(), 'config.json');
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config;
}

/**
 * Ottiene la configurazione corrente
 * @returns {Object} Oggetto di configurazione
 */
function getConfig() {
    if (!config) {
        loadConfig();
    }
    return config;
}

/**
 * Salva la configurazione nel file config.json
 * @param {Object} newConfig - Nuova configurazione da salvare
 */
function saveConfig(newConfig) {
    const configPath = path.join(process.cwd(), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    config = newConfig;
}

module.exports = { loadConfig, getConfig, saveConfig };
