const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../utils/logger');

class ConfigManager {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = null;
        this.watchers = new Map();
        this.changeCallbacks = [];
    }

    async load() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            logger.info(`[LogConfigManager] Configuration loaded from ${this.configPath}`);
            return this.config;
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn(`[LogConfigManager] Configuration file not found, creating default...`);
                await this.createDefault();
                return this.config;
            }
            throw error;
        }
    }

    async createDefault() {
        this.config = {
            enabled: true,
            guilds: {},
            defaults: {
                enabled: true,
                channels: {},
                filters: {
                    ignoreBots: true,
                    ignoreWebhooks: true,
                    ignoreChannels: [],
                    ignoreRoles: [],
                    ignoreUsers: []
                },
                formatting: {
                    timezone: 'Europe/Rome',
                    dateFormat: 'DD/MM/YYYY HH:mm:ss',
                    embedColor: '#5865F2',
                    thumbnails: true,
                    timestamps: true
                },
                events: {}
            }
        };
        await this.save();
    }

    async save() {
        try {
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 4), 'utf8');
            logger.info(`[LogConfigManager] Configuration saved to ${this.configPath}`);
            this.notifyChanges();
        } catch (error) {
            logger.error(`[LogConfigManager] Error saving configuration:`, error);
            throw error;
        }
    }

    getGuildConfig(guildId) {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call load() first.');
        }

        if (!this.config.guilds[guildId]) {
            logger.info(`[LogConfigManager] Creating new guild config for ${guildId}`);
            this.config.guilds[guildId] = JSON.parse(JSON.stringify(this.config.defaults));
            // Salva immediatamente per persistere la nuova guild
            this.save().catch(err => logger.error('[LogConfigManager] Error saving new guild config:', err));
        }

        return this.config.guilds[guildId];
    }

    async updateGuildConfig(guildId, updates) {
        const guildConfig = this.getGuildConfig(guildId);
        this.deepMerge(guildConfig, updates);
        await this.save();
    }

    getEventChannel(guildId, eventName) {
        const config = this.getGuildConfig(guildId);
        
        if (!config.enabled) return null;
        
        // Importa EventRegistry per trovare la categoria dell'evento
        const EventRegistry = require('./EventRegistry');
        const eventInfo = EventRegistry.getEventByName(eventName);
        
        if (!eventInfo) {
            logger.warn(`[LogConfigManager] Event ${eventName} not found in registry`);
            return null;
        }
        
        const categoryName = eventInfo.category;

        const categoryConfig = config.events[categoryName];
        if (!categoryConfig) {
            logger.warn(`[LogConfigManager] Category ${categoryName} not found in guild ${guildId} config`);
            return null;
        }

        const eventConfig = categoryConfig[eventName];
        if (!eventConfig || !eventConfig.enabled) return null;

        const channelRef = eventConfig.channel || config.channels.default;
        
        return this.resolveChannelReference(config, channelRef);
    }

    resolveChannelReference(config, channelRef) {
        if (!channelRef) return null;
        
        if (/^\d+$/.test(channelRef.toString())) {
            return channelRef.toString();
        }
        
        if (config.channels && config.channels[channelRef]) {
            return config.channels[channelRef];
        }
        
        return channelRef;
    }

    isEventEnabled(guildId, eventName) {
        const config = this.getGuildConfig(guildId);
        
        if (!config.enabled) return false;
        
        // Importa EventRegistry per trovare la categoria dell'evento
        const EventRegistry = require('./EventRegistry');
        const eventInfo = EventRegistry.getEventByName(eventName);
        
        if (!eventInfo) return false;
        
        const categoryName = eventInfo.category;
        const categoryConfig = config.events[categoryName];
        
        if (!categoryConfig) return false;
        
        const eventConfig = categoryConfig[eventName];
        if (!eventConfig) return false;
        
        return eventConfig.enabled === true;
    }

    shouldIgnore(guildId, entity) {
        const config = this.getGuildConfig(guildId);
        const filters = config.filters;

        if (!entity) return false;

        if (filters.ignoreBots && entity.user?.bot) return true;
        if (filters.ignoreBots && entity.bot) return true;

        if (filters.ignoreWebhooks && entity.webhookId) return true;

        if (entity.channelId && filters.ignoreChannels.includes(entity.channelId)) return true;
        if (entity.channel?.id && filters.ignoreChannels.includes(entity.channel.id)) return true;

        if (entity.userId && filters.ignoreUsers.includes(entity.userId)) return true;
        if (entity.user?.id && filters.ignoreUsers.includes(entity.user.id)) return true;
        if (entity.id && filters.ignoreUsers.includes(entity.id)) return true;

        if (entity.roles?.cache) {
            const hasIgnoredRole = entity.roles.cache.some(role => 
                filters.ignoreRoles.includes(role.id)
            );
            if (hasIgnoredRole) return true;
        }

        return false;
    }

    getFormatting(guildId) {
        const config = this.getGuildConfig(guildId);
        return config.formatting;
    }

    onChange(callback) {
        this.changeCallbacks.push(callback);
    }

    notifyChanges() {
        for (const callback of this.changeCallbacks) {
            try {
                callback(this.config);
            } catch (error) {
                logger.error('[LogConfigManager] Error in change callback:', error);
            }
        }
    }

    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    async enableEvent(guildId, eventName, channelId) {
        const config = this.getGuildConfig(guildId);
        
        const EventRegistry = require('./EventRegistry');
        const eventInfo = EventRegistry.getEventByName(eventName);
        
        if (!eventInfo) {
            logger.warn(`[LogConfigManager] Event ${eventName} not found in registry`);
            return;
        }
        
        const categoryName = eventInfo.category;
        
        if (!config.events[categoryName]) {
            config.events[categoryName] = {};
        }
        
        if (!config.events[categoryName][eventName]) {
            config.events[categoryName][eventName] = {};
        }
        
        config.events[categoryName][eventName].enabled = true;
        
        if (channelId) {
            config.events[categoryName][eventName].channel = channelId;
        }
        
        await this.save();
    }

    async disableEvent(guildId, eventName) {
        const config = this.getGuildConfig(guildId);
        
        const EventRegistry = require('./EventRegistry');
        const eventInfo = EventRegistry.getEventByName(eventName);
        
        if (!eventInfo) return;
        
        const categoryName = eventInfo.category;
        
        if (config.events[categoryName] && config.events[categoryName][eventName]) {
            config.events[categoryName][eventName].enabled = false;
            await this.save();
        }
    }

    getGuildEvents(guildId) {
        const config = this.getGuildConfig(guildId);
        return config.events;
    }

    async resetGuildConfig(guildId) {
        this.config.guilds[guildId] = JSON.parse(JSON.stringify(this.config.defaults));
        await this.save();
    }

    export() {
        return JSON.parse(JSON.stringify(this.config));
    }

    async import(config) {
        this.config = config;
        await this.save();
    }
}

module.exports = ConfigManager;