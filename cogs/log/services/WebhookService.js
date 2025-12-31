const { WebhookClient, Collection } = require('discord.js');
const logger = require('../../../utils/logger');

class WebhookService {
    constructor() {
        this.cache = new Collection();
    }

    resolve(target, client) {
        if (!target) return null;
        const value = String(target).trim();
        if (!value) return null;

        if (value.startsWith('http://') || value.startsWith('https://')) {
            try {
                if (!this.cache.has(value)) {
                    const webhookClient = new WebhookClient({ url: value });
                    this.cache.set(value, webhookClient);
                }
                return { type: 'webhook', client: this.cache.get(value) };
            } catch (err) {
                logger.error(`Webhook URL non valido: ${err.message}`);
                return null;
            }
        }

        const channel = client.channels.cache.get(value);
        if (!channel || !channel.isTextBased?.()) return null;
        return { type: 'channel', channel };
    }

    async send(resolved, payload) {
        if (!resolved) return;

        if (resolved.type === 'channel') {
            await resolved.channel.send(payload);
        } else if (resolved.type === 'webhook') {
            await resolved.client.send(payload);
        }
    }
}

module.exports = WebhookService;
