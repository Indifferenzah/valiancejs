const { PermissionFlagsBits } = require('discord.js');

class BypassHandler {
    constructor(config) {
        this.config = config;
    }

    isBypassed(message) {
        if (message.author.bot) {
            return true;
        }

        if (!message.guild || !message.member) {
            return true;
        }

        if (this.config.admin && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return true;
        }

        if (this.config.roles.length > 0) {
            const hasRole = message.member.roles.cache.some(role =>
                this.config.roles.includes(role.id)
            );
            if (hasRole) {
                return true;
            }
        }

        if (this.config.users.length > 0 && this.config.users.includes(message.author.id)) {
            return true;
        }

        if (this.config.channels.length > 0 && this.config.channels.includes(message.channel.id)) {
            return true;
        }

        return false;
    }

    shouldProcess(message) {
        if (!message.content || message.content.trim().length === 0) {
            return false;
        }

        if (this.isBypassed(message)) {
            return false;
        }

        return true;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

module.exports = BypassHandler;
