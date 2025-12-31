const logger = require('../../../utils/logger');

class CommandLogger {
    constructor(config, embedService, client) {
        this.config = config;
        this.embedService = embedService;
        this.client = client;
    }

    async logCommandExecuted(user, guild, commandName, channel, args) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            command: commandName,
            channel: channel.toString(),
            args: args?.join(' ') || 'Nessuno',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'success'
        };

        await this.embedService.send(
            this.config.getChannel('command'),
            this.config.getMessage('command_executed'),
            this.client,
            user,
            variables
        );
    }

    async logCommandFailed(user, guild, commandName, error, channel) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            command: commandName,
            channel: channel.toString(),
            error: error || 'Errore sconosciuto',
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'fail'
        };

        await this.embedService.send(
            this.config.getChannel('command'),
            this.config.getMessage('command_failed'),
            this.client,
            user,
            variables
        );
    }

    async logCommandNoPermission(user, guild, commandName, requiredPermission, channel) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            command: commandName,
            channel: channel.toString(),
            required_permission: requiredPermission,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'denied'
        };

        await this.embedService.send(
            this.config.getChannel('command'),
            this.config.getMessage('command_no_permission'),
            this.client,
            user,
            variables
        );
    }

    async logCommandCooldown(user, guild, commandName, remainingTime, channel) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            command: commandName,
            channel: channel.toString(),
            remaining_time: String(remainingTime),
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'cooldown'
        };

        await this.embedService.send(
            this.config.getChannel('command'),
            this.config.getMessage('command_cooldown'),
            this.client,
            user,
            variables
        );
    }

    async logCommandByBot(botUser, guild, commandName, channel) {
        const variables = {
            mention: botUser.toString(),
            id: botUser.id,
            avatar: botUser.displayAvatarURL(),
            guild_id: guild.id,
            command: commandName,
            channel: channel.toString(),
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'bot',
            outcome: 'blocked'
        };

        await this.embedService.send(
            this.config.getChannel('command'),
            this.config.getMessage('command_by_bot'),
            this.client,
            botUser,
            variables
        );
    }

    async logInvalidParameters(user, guild, commandName, invalidParams, channel) {
        const variables = {
            mention: user.toString(),
            id: user.id,
            avatar: user.displayAvatarURL(),
            guild_id: guild.id,
            command: commandName,
            channel: channel.toString(),
            invalid_params: invalidParams,
            timestamp: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            origin: 'command',
            outcome: 'invalid'
        };

        await this.embedService.send(
            this.config.getChannel('command'),
            this.config.getMessage('command_invalid_params'),
            this.client,
            user,
            variables
        );
    }
}

module.exports = CommandLogger;
