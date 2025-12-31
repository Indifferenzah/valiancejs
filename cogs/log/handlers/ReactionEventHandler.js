const logger = require('../../../utils/logger');

class ReactionEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('messageReactionAdd', this.handleReactionAdd.bind(this));
        this.client.on('messageReactionRemove', this.handleReactionRemove.bind(this));
    }

    async handleReactionAdd(reaction, user) {
        try {
            if (user.bot) return;
            if (reaction.partial) await reaction.fetch();

            const variables = {
                emoji: reaction.emoji.toString(),
                user: user.toString(),
                channel: reaction.message.channel.toString(),
                message_id: reaction.message.id
            };

            await this.embedService.send(
                this.config.getChannel('message'),
                this.config.getMessage('reaction_add'),
                this.client,
                user,
                variables
            );
        } catch (err) {
            logger.error(`Errore log reaction add: ${err.message}`);
        }
    }

    async handleReactionRemove(reaction, user) {
        try {
            if (user.bot) return;
            if (reaction.partial) await reaction.fetch();

            const variables = {
                emoji: reaction.emoji.toString(),
                user: user.toString(),
                channel: reaction.message.channel.toString(),
                message_id: reaction.message.id
            };

            await this.embedService.send(
                this.config.getChannel('message'),
                this.config.getMessage('reaction_remove'),
                this.client,
                user,
                variables
            );
        } catch (err) {
            logger.error(`Errore log reaction remove: ${err.message}`);
        }
    }
}

module.exports = ReactionEventHandler;
