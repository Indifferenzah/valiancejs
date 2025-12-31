class TicketLogger {
    constructor(config, embedService, client) {
        this.config = config;
        this.embedService = embedService;
        this.client = client;
    }

    async logTicketOpen(user, channel, number, category) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            channel,
            number,
            category
        };

        await this.embedService.send(
            this.config.getChannel('ticket'),
            this.config.getMessage('ticket_open'),
            this.client,
            user,
            variables
        );
    }

    async logTicketClose(channel, opener, staffer, number) {
        const variables = {
            channel,
            opener,
            staffer,
            number
        };

        await this.embedService.send(
            this.config.getChannel('ticket'),
            this.config.getMessage('ticket_close'),
            this.client,
            null,
            variables
        );
    }

    async logTicketRename(channel, newName, staffer, number) {
        const variables = {
            channel,
            new_name: newName,
            staffer,
            number
        };

        await this.embedService.send(
            this.config.getChannel('ticket'),
            this.config.getMessage('ticket_rename'),
            this.client,
            null,
            variables
        );
    }

    async logTicketAdd(member, channel, staffer, number) {
        const variables = {
            member,
            channel,
            staffer,
            number
        };

        await this.embedService.send(
            this.config.getChannel('ticket'),
            this.config.getMessage('ticket_add'),
            this.client,
            null,
            variables
        );
    }

    async logTicketRemove(member, channel, staffer, number) {
        const variables = {
            member,
            channel,
            staffer,
            number
        };

        await this.embedService.send(
            this.config.getChannel('ticket'),
            this.config.getMessage('ticket_remove'),
            this.client,
            null,
            variables
        );
    }
}

module.exports = TicketLogger;
