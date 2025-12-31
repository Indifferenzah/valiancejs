const { loadJsonSync, saveJsonSync } = require('../../../utils/jsonStore');
const logger = require('../../../utils/logger');

class ConfigManager {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            return loadJsonSync(this.configPath, this.getDefaultConfig());
        } catch (error) {
            logger.error(`[BIRTHDAYS] Errore caricamento config: ${error.message}`);
            return this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            enabled: true,
            checkInterval: 60,
            notifications: {
                enabled: true,
                channelId: null,
                roleId: null,
                announcementTime: '09:00',
                useEmbed: true,
                mentionUser: true
            },
            messages: {
                birthday: '🎉 Buon compleanno {user}! 🎉\n🎂 Auguri da tutto il server! 🎂',
                dmBirthday: '🎉 Buon compleanno! 🎉\nIl server {guild} ti augura una fantastica giornata! 🎂'
            }
        };
    }

    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        let obj = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in obj) || typeof obj[k] !== 'object') {
                obj[k] = {};
            }
            obj = obj[k];
        }

        obj[keys[keys.length - 1]] = value;
        this.save();
    }

    save() {
        try {
            saveJsonSync(this.configPath, this.config);
        } catch (error) {
            logger.error(`[BIRTHDAYS] Errore salvataggio config: ${error.message}`);
        }
    }

    reload() {
        this.config = this.loadConfig();
    }

    isEnabled() {
        return this.get('enabled', true);
    }

    getNotificationConfig() {
        return this.get('notifications', this.getDefaultConfig().notifications);
    }

    getMessagesConfig() {
        return this.get('messages', this.getDefaultConfig().messages);
    }
}

module.exports = ConfigManager;
