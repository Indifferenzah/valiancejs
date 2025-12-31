const { loadJsonSync, saveJsonSync } = require('../../../utils/jsonStore');
const path = require('path');

class ConfigManager {
    constructor(configPath) {
        this.configPath = configPath || path.join(__dirname, '..', 'log.json');
        this.config = this.load();
    }

    load() {
        return loadJsonSync(this.configPath, {});
    }

    save() {
        saveJsonSync(this.configPath, this.config);
    }

    reload() {
        this.config = this.load();
    }

    get(key) {
        return this.config[key];
    }

    set(key, value) {
        this.config[key] = value;
    }

    getChannel(channelKey) {
        return this.config[`${channelKey}_channel`];
    }

    getMessage(messageKey) {
        return this.config[`${messageKey}_message`];
    }
}

module.exports = ConfigManager;
