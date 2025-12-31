class AutomodLogger {
    constructor(config, embedService, client) {
        this.config = config;
        this.embedService = embedService;
        this.client = client;
    }

    async logAutomodMute(user, reason, duration) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            reason: reason || 'Nessuna ragione',
            duration: duration || 'Permanente'
        };

        await this.embedService.send(
            this.config.getChannel('automod'),
            this.config.getMessage('automod_mute'),
            this.client,
            user,
            variables
        );
    }

    async logAutomodWarn(user, word) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            word
        };

        await this.embedService.send(
            this.config.getChannel('automod'),
            this.config.getMessage('automod_warn'),
            this.client,
            user,
            variables
        );
    }
}

module.exports = AutomodLogger;
