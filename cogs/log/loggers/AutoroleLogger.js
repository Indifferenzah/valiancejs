class AutoroleLogger {
    constructor(config, embedService, client) {
        this.config = config;
        this.embedService = embedService;
        this.client = client;
    }

    async logAutoroleAdd(user, role) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            role: role.toString()
        };

        await this.embedService.send(
            this.config.getChannel('autorole'),
            this.config.getMessage('autorole_add'),
            this.client,
            user,
            variables
        );
    }

    async logAutoroleRemove(user, role) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            role: role.toString()
        };

        await this.embedService.send(
            this.config.getChannel('autorole'),
            this.config.getMessage('autorole_remove'),
            this.client,
            user,
            variables
        );
    }
}

module.exports = AutoroleLogger;
