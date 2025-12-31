const { AuditLogEvent } = require('discord.js');
const AuditService = require('../services/AuditService');
const logger = require('../../../utils/logger');

class EmojiEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('emojiCreate', this.handleEmojiCreate.bind(this));
        this.client.on('emojiDelete', this.handleEmojiDelete.bind(this));
        this.client.on('emojiUpdate', this.handleEmojiUpdate.bind(this));
    }

    async handleEmojiCreate(emoji) {
        try {
            const guild = emoji.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.EmojiCreate, emoji.id, guild);

            const variables = {
                emojis: `${emoji} (\`${emoji.name}\`)`,
                staffer
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('emoji_create'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log emoji create: ${err.message}`);
        }
    }

    async handleEmojiDelete(emoji) {
        try {
            const guild = emoji.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.EmojiDelete, emoji.id, guild);

            const variables = {
                emojis: `${emoji.name}`,
                staffer
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('emoji_delete'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log emoji delete: ${err.message}`);
        }
    }

    async handleEmojiUpdate(oldEmoji, newEmoji) {
        try {
            const guild = newEmoji.guild;
            if (!guild) return;

            const staffer = await AuditService.getExecutor(AuditLogEvent.EmojiUpdate, newEmoji.id, guild);

            const variables = {
                emojis: `${oldEmoji.name} → ${newEmoji.name}`,
                staffer
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('emoji_update'),
                this.client,
                null,
                variables
            );
        } catch (err) {
            logger.error(`Errore log emoji update: ${err.message}`);
        }
    }
}

module.exports = EmojiEventHandler;
