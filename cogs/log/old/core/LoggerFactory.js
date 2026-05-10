const BaseLogger = require('./BaseLogger');
const EventRegistry = require('./EventRegistry');
const logger = require('../../../utils/logger');

class LoggerFactory {
    constructor(client, configManager) {
        this.client = client;
        this.configManager = configManager;
        this.loggers = new Map();
        this.customHandlers = new Map();
    }

    getLogger(eventName) {
        if (this.loggers.has(eventName)) {
            return this.loggers.get(eventName);
        }

        const eventMetadata = EventRegistry.getEventByName(eventName);
        
        if (!eventMetadata) {
            logger.warn(`[LoggerFactory] Event ${eventName} not found in registry`);
            return null;
        }

        const eventLogger = new BaseLogger(this.client, this.configManager, eventMetadata);

        if (this.customHandlers.has(eventName)) {
            const originalLog = eventLogger.log.bind(eventLogger);
            const customHandler = this.customHandlers.get(eventName);

            eventLogger.log = async (...args) => {
                try {
                    const processedData = await customHandler(...args);
                    if (processedData !== false) { // false = skip logging
                        return await originalLog(processedData.guildId || args[0], processedData.embedData || args[1]);
                    }
                } catch (error) {
                    logger.error(`[LoggerFactory] Error in custom handler for ${eventName}:`, error);
                    return await originalLog(...args);
                }
            };
        }

        this.loggers.set(eventName, eventLogger);

        return eventLogger;
    }

    registerCustomHandler(eventName, handler) {
        this.customHandlers.set(eventName, handler);
        
        if (this.loggers.has(eventName)) {
            this.loggers.delete(eventName);
        }
    }

    getAllLoggers() {
        const events = EventRegistry.getAllEvents();
        const loggers = {};

        for (const event of events) {
            loggers[event.name] = this.getLogger(event.name);
        }

        return loggers;
    }

    getLoggersByCategory(category) {
        const events = EventRegistry.getEventsByCategory(category);
        const loggers = {};

        for (const event of events) {
            loggers[event.name] = this.getLogger(event.name);
        }

        return loggers;
    }

    clearCache() {
        this.loggers.clear();
    }

    reload() {
        this.clearCache();
        return this.getAllLoggers();
    }
}

module.exports = LoggerFactory;
