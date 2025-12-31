const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = null;
        this.load();
    }

    load() {
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(data);
        } catch (error) {
            throw new Error(`Errore caricamento configurazione: ${error.message}`);
        }
    }

    save() {
        try {
            fs.writeFileSync(
                this.configPath,
                JSON.stringify(this.config, null, 2),
                'utf8'
            );
        } catch (error) {
            throw new Error(`Errore salvataggio configurazione: ${error.message}`);
        }
    }

    reload() {
        this.load();
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
        let target = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in target)) {
                target[k] = {};
            }
            target = target[k];
        }

        target[keys[keys.length - 1]] = value;
    }

    isEnabled() {
        return this.get('enabled', false);
    }

    getThreshold(type) {
        return this.get(`thresholds.${type}`, 0.5);
    }

    getOpenAIConfig() {
        return {
            apiKey: this.get('openai.api_key') || process.env.OPENAI_API_KEY,
            model: this.get('openai.model', 'gpt-4'),
            maxTokens: this.get('openai.max_tokens', 150),
            temperature: this.get('openai.temperature', 0.3)
        };
    }

    getModerationConfig() {
        return {
            enabled: this.get('moderation.enabled', true),
            useOpenAIModeration: this.get('moderation.use_openai_moderation', true),
            useCustomAnalysis: this.get('moderation.use_custom_analysis', true),
            checkToxicity: this.get('moderation.check_toxicity', true),
            checkSpam: this.get('moderation.check_spam', true),
            checkIntent: this.get('moderation.check_intent', true)
        };
    }

    getBypassConfig() {
        return {
            admin: this.get('bypass.admin', true),
            roles: this.get('bypass.roles', []),
            users: this.get('bypass.users', []),
            channels: this.get('bypass.channels', [])
        };
    }

    getActionConfig() {
        return {
            deleteMessage: this.get('actions.delete_message', true),
            timeout: this.get('actions.timeout', true),
            warn: this.get('actions.warn', true),
            ban: this.get('actions.ban', false),
            timeoutDuration: this.get('actions.timeout_duration', 600000),
            banThreshold: this.get('actions.ban_threshold', 3),
            notifyUser: this.get('actions.notify_user', true),
            notifyChannel: this.get('actions.notify_channel', true)
        };
    }

    getLogConfig() {
        return {
            enabled: this.get('logging.enabled', true),
            webhookUrl: this.get('logging.webhook_url', ''),
            channelId: this.get('logging.channel_id', ''),
            useWebhook: this.get('logging.use_webhook', true),
            logLevel: this.get('logging.log_level', 'info'),
            includeContent: this.get('logging.include_content', true)
        };
    }

    getCooldownConfig() {
        return {
            enabled: this.get('cooldown.enabled', true),
            duration: this.get('cooldown.duration', 4000),
            perUser: this.get('cooldown.per_user', true)
        };
    }
}

module.exports = ConfigManager;
