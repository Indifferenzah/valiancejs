const { AuditLogEvent } = require('discord.js');
const AuditService = require('../services/AuditService');
const logger = require('../../../utils/logger');

class StickerEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('stickerCreate', this.handleStickerCreate.bind(this));
        this.client.on('stickerDelete', this.handleStickerDelete.bind(this));
        this.client.on('stickerUpdate', this.handleStickerUpdate.bind(this));
    }

    async handleStickerCreate(sticker) {
        try {
            const guild = sticker.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.StickerCreate, sticker.id, guild);

            const variables = {
                stickers: `${sticker.name}`,
                staffer
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('sticker_create'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log sticker create: ${err.message}`);
        }
    }

    async handleStickerDelete(sticker) {
        try {
            const guild = sticker.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.StickerDelete, sticker.id, guild);

            const variables = {
                stickers: `${sticker.name}`,
                staffer
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('sticker_delete'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log sticker delete: ${err.message}`);
        }
    }

    async handleStickerUpdate(oldSticker, newSticker) {
        try {
            const guild = newSticker.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.StickerUpdate, newSticker.id, guild);

            const variables = {
                stickers: `${oldSticker.name} → ${newSticker.name}`,
                staffer
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('sticker_update'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log sticker update: ${err.message}`);
        }
    }
}

module.exports = StickerEventHandler;
