const { AuditLogEvent } = require('discord.js');
const AuditService = require('../services/AuditService');
const Formatters = require('../core/Formatters');
const logger = require('../../../utils/logger');

class ThreadEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('threadCreate', this.handleThreadCreate.bind(this));
        this.client.on('threadDelete', this.handleThreadDelete.bind(this));
        this.client.on('threadUpdate', this.handleThreadUpdate.bind(this));
    }

    async handleThreadCreate(thread) {
        try {
            const guild = thread.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.ThreadCreate, thread.id, guild);

            const variables = {
                thread: thread.toString(),
                staffer,
                id: thread.id
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('thread_create'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log thread create: ${err.message}`);
        }
    }

    async handleThreadDelete(thread) {
        try {
            const guild = thread.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.ThreadDelete, thread.id, guild);

            const variables = {
                name: thread.name,
                staffer,
                id: thread.id
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('thread_delete'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log thread delete: ${err.message}`);
        }
    }

    async handleThreadUpdate(oldThread, newThread) {
        try {
            const guild = newThread.guild;
            if (!guild) return;

            const entry = await AuditService.getEntry(AuditLogEvent.ThreadUpdate, newThread.id, guild);
            const staffer = entry?.executor?.tag || 'Sistema';
            const changes = Formatters.formatAuditChanges(entry);

            const variables = {
                thread: newThread.toString(),
                staffer,
                changes
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('thread_update'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log thread update: ${err.message}`);
        }
    }
}

module.exports = ThreadEventHandler;
