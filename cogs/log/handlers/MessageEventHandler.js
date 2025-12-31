const logger = require('../../../utils/logger');

class MessageEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('messageDelete', this.handleMessageDelete.bind(this));
        this.client.on('messageUpdate', this.handleMessageUpdate.bind(this));
    }

    async handleMessageDelete(message) {
        try {
            if (!message || message.partial) return;
            if (message.author?.bot) return;
            if (!message.content) return;

            const variables = {
                mention: message.author.toString(),
                id: message.author.id,
                avatar: message.author.displayAvatarURL(),
                channel: message.channel.toString(),
                content: message.content.substring(0, 1000)
            };

            await this.embedService.send(
                this.config.getChannel('message'),
                this.config.getMessage('message_delete'),
                this.client,
                message.author,
                variables
            );
        } catch (err) {
            logger.error(`Errore log message delete: ${err.message}`);
        }
    }

    async handleMessageUpdate(oldMessage, newMessage) {
        try {
            if (!newMessage || newMessage.partial) return;
            if (newMessage.author?.bot) return;
            if (!oldMessage.content || !newMessage.content) return;
            if (oldMessage.content === newMessage.content) return;

            await this.handlePinUpdate(oldMessage, newMessage);

            const variables = {
                mention: newMessage.author.toString(),
                id: newMessage.author.id,
                avatar: newMessage.author.displayAvatarURL(),
                channel: newMessage.channel.toString(),
                old_content: oldMessage.content.substring(0, 500),
                new_content: newMessage.content.substring(0, 500)
            };

            await this.embedService.send(
                this.config.getChannel('message'),
                this.config.getMessage('message_edit'),
                this.client,
                newMessage.author,
                variables
            );
        } catch (err) {
            logger.error(`Errore log message update: ${err.message}`);
        }
    }

    async handlePinUpdate(oldMessage, newMessage) {
        if (!oldMessage.pinned && newMessage.pinned) {
            const variables = {
                channel: newMessage.channel.toString(),
                message_id: newMessage.id,
                author: newMessage.author?.toString() || 'Sconosciuto'
            };

            await this.embedService.send(
                this.config.getChannel('message'),
                this.config.getMessage('message_pin'),
                this.client,
                newMessage.author,
                variables
            );
        } else if (oldMessage.pinned && !newMessage.pinned) {
            const variables = {
                channel: newMessage.channel.toString(),
                message_id: newMessage.id,
                author: newMessage.author?.toString() || 'Sconosciuto'
            };

            await this.embedService.send(
                this.config.getChannel('message'),
                this.config.getMessage('message_unpin'),
                this.client,
                newMessage.author,
                variables
            );
        }
    }
}

module.exports = MessageEventHandler;
