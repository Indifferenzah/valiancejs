const { EmbedBuilder, WebhookClient } = require('discord.js');
const logger = require('../../../utils/logger');

class BaseLogger {
    constructor(client, configManager, eventMetadata) {
        this.client = client;
        this.configManager = configManager;
        this.eventMetadata = eventMetadata;
        this.webhookCache = new Map();
    }

    async log(guildId, embedData) {
        try {
            const isEnabled = this.configManager.isEventEnabled(guildId, this.eventMetadata.name);
            
            if (!isEnabled) return;

            const channelId = this.configManager.getEventChannel(guildId, this.eventMetadata.name);

            if (!channelId) return;

            const formatting = this.configManager.getFormatting(guildId);

            const embed = await this.createEmbed(embedData, formatting);

            await this.sendLog(channelId, embed);

        } catch (error) {
            logger.error(`[BaseLogger] Error logging event ${this.eventMetadata.name}:`, error);
        }
    }

    async createEmbed(data, formatting) {
        const embed = new EmbedBuilder()
            .setColor(data.color || this.eventMetadata.color || formatting.embedColor)
            .setTimestamp();

        if (data.title) {
            embed.setTitle(`${this.eventMetadata.icon || '📝'} ${data.title}`);
        }

        if (data.description) {
            embed.setDescription(data.description);
        }

        if (data.fields && Array.isArray(data.fields)) {
            embed.addFields(data.fields);
        }

        if (data.thumbnail && formatting.thumbnails) {
            embed.setThumbnail(data.thumbnail);
        }

        if (data.image) {
            embed.setImage(data.image);
        }

        if (data.footer) {
            embed.setFooter(data.footer);
        }

        if (data.author) {
            embed.setAuthor(data.author);
        }

        return embed;
    }

    async sendLog(channelId, embed) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            
            if (!channel) {
                logger.warn(`[BaseLogger] Channel ${channelId} not found`);
                return;
            }

            if (!channel.isTextBased()) {
                logger.warn(`[BaseLogger] Channel ${channelId} is not text-based`);
                return;
            }

            await channel.send({ embeds: [embed] });

        } catch (error) {
            logger.error(`[BaseLogger] Error sending log to channel ${channelId}:`, error);
        }
    }

    formatTimestamp(date, format) {
        if (!date) return 'N/A';
        
        const timestamp = date instanceof Date ? date : new Date(date);
        
        if (isNaN(timestamp)) return 'Invalid Date';

        return `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`;
    }

    formatUser(user) {
        if (!user) return 'Unknown User';
        return `${user.tag} (${user.id})`;
    }

    formatChannel(channel) {
        if (!channel) return 'Unknown Channel';
        return `${channel.name} (<#${channel.id}>)`;
    }

    formatRole(role) {
        if (!role) return 'Unknown Role';
        return `${role.name} (<@&${role.id}>)`;
    }

    truncate(text, maxLength = 1024) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    getDifferences(oldObj, newObj, fields) {
        const differences = [];

        for (const field of fields) {
            const oldValue = this.getNestedValue(oldObj, field.key);
            const newValue = this.getNestedValue(newObj, field.key);

            if (oldValue !== newValue) {
                differences.push({
                    name: field.name,
                    value: `**Prima:** ${this.formatValue(oldValue)}\n**Dopo:** ${this.formatValue(newValue)}`,
                    inline: field.inline || false
                });
            }
        }

        return differences;
    }

    getNestedValue(obj, key) {
        const keys = key.split('.');
        let value = obj;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return undefined;
            }
        }

        return value;
    }

    formatValue(value) {
        if (value === undefined || value === null) return 'N/A';
        if (typeof value === 'boolean') return value ? 'Sì' : 'No';
        if (typeof value === 'object') return JSON.stringify(value);
        if (typeof value === 'string' && value.length > 100) return this.truncate(value, 100);
        return String(value);
    }

    async getExecutor(guild, actionType, targetId) {
        try {
            const auditLogs = await guild.fetchAuditLogs({
                limit: 5,
                type: actionType
            });

            const auditEntry = auditLogs.entries.find(entry => 
                entry.targetId === targetId
            );

            return auditEntry ? auditEntry.executor : null;

        } catch (error) {
            logger.error(`[BaseLogger] Error fetching audit logs:`, error);
            return null;
        }
    }

    createFieldsFromObject(obj, labels = {}) {
        const fields = [];

        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined && value !== null) {
                fields.push({
                    name: labels[key] || this.capitalize(key),
                    value: this.formatValue(value),
                    inline: true
                });
            }
        }

        return fields;
    }

    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    async getWebhook(channelId) {
        if (this.webhookCache.has(channelId)) {
            return this.webhookCache.get(channelId);
        }

        try {
            const channel = await this.client.channels.fetch(channelId);
            
            if (!channel || !channel.isTextBased()) {
                return null;
            }

            const webhooks = await channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.owner.id === this.client.user.id);

            if (!webhook) {
                webhook = await channel.createWebhook({
                    name: 'Valiance Logs',
                    avatar: this.client.user.displayAvatarURL()
                });
            }

            this.webhookCache.set(channelId, webhook);
            return webhook;

        } catch (error) {
            logger.error(`[BaseLogger] Error getting webhook for channel ${channelId}:`, error);
            return null;
        }
    }

    clearWebhookCache() {
        this.webhookCache.clear();
    }
}

module.exports = BaseLogger;
