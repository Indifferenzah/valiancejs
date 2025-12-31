const logger = require('../../../utils/logger');

class BulkMessageEventHandler {
    constructor(config, embedService, client) {
        this.config = config;
        this.embedService = embedService;
        this.client = client;
    }

    async logBulkDelete(channel, messageCount, executor) {
        const variables = {
            channel: channel.toString(),
            guild_id: channel.guild.id,
            message_count: String(messageCount),
            executor: executor || 'Sconosciuto',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('message'),
            this.config.getMessage('bulk_delete'),
            this.client,
            null,
            variables
        );
    }

    async logMessageBlocked(message, reason, origin = 'AI') {
        const variables = {
            mention: message.author.toString(),
            id: message.author.id,
            avatar: message.author.displayAvatarURL(),
            guild_id: message.guild.id,
            channel: message.channel.toString(),
            reason: reason,
            content: message.content?.substring(0, 500) || 'Nessun contenuto',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: origin,
            outcome: 'blocked'
        };

        await this.embedService.send(
            this.config.getChannel('message'),
            this.config.getMessage('message_blocked'),
            this.client,
            message.author,
            variables
        );
    }

    async logMessageReported(message, reporter, reason) {
        const variables = {
            mention: message.author.toString(),
            id: message.author.id,
            avatar: message.author.displayAvatarURL(),
            guild_id: message.guild.id,
            channel: message.channel.toString(),
            reporter: reporter.toString(),
            reason: reason,
            content: message.content?.substring(0, 500) || 'Nessun contenuto',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'user',
            outcome: 'flagged'
        };

        await this.embedService.send(
            this.config.getChannel('message'),
            this.config.getMessage('message_reported'),
            this.client,
            message.author,
            variables
        );
    }

    async logLinkDetected(message, link, isSuspicious) {
        const variables = {
            mention: message.author.toString(),
            id: message.author.id,
            avatar: message.author.displayAvatarURL(),
            guild_id: message.guild.id,
            channel: message.channel.toString(),
            link: link,
            suspicious: isSuspicious ? 'Sì' : 'No',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'sistema',
            outcome: isSuspicious ? 'flagged' : 'logged'
        };

        await this.embedService.send(
            this.config.getChannel('message'),
            this.config.getMessage('link_detected'),
            this.client,
            message.author,
            variables
        );
    }

    async logAttachmentUploaded(message, attachment) {
        const variables = {
            mention: message.author.toString(),
            id: message.author.id,
            avatar: message.author.displayAvatarURL(),
            guild_id: message.guild.id,
            channel: message.channel.toString(),
            filename: attachment.name,
            size: String(attachment.size),
            type: attachment.contentType || 'Sconosciuto',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'user',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('message'),
            this.config.getMessage('attachment_uploaded'),
            this.client,
            message.author,
            variables
        );
    }

    async logSuspiciousFile(message, attachment, reason) {
        const variables = {
            mention: message.author.toString(),
            id: message.author.id,
            avatar: message.author.displayAvatarURL(),
            guild_id: message.guild.id,
            channel: message.channel.toString(),
            filename: attachment.name,
            size: String(attachment.size),
            type: attachment.contentType || 'Sconosciuto',
            reason: reason,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'sistema',
            outcome: 'flagged'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('suspicious_file'),
            this.client,
            message.author,
            variables
        );
    }

    async logMassMention(message, mentionType, mentionCount) {
        const variables = {
            mention: message.author.toString(),
            id: message.author.id,
            avatar: message.author.displayAvatarURL(),
            guild_id: message.guild.id,
            channel: message.channel.toString(),
            mention_type: mentionType,
            mention_count: String(mentionCount),
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'sistema',
            outcome: 'flagged'
        };

        await this.embedService.send(
            this.config.getChannel('security'),
            this.config.getMessage('mass_mention'),
            this.client,
            message.author,
            variables
        );
    }
}

module.exports = BulkMessageEventHandler;
