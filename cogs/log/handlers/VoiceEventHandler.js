const logger = require('../../../utils/logger');

class VoiceEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('voiceStateUpdate', this.handleVoiceStateUpdate.bind(this));
    }

    async handleVoiceStateUpdate(oldState, newState) {
        try {
            if (newState.member?.user?.bot) return;
            const member = newState.member || oldState.member;
            if (!member) return;

            const oldChannel = oldState.channel;
            const newChannel = newState.channel;

            if (!oldChannel && newChannel) {
                await this.handleJoin(member, newChannel);
            } else if (oldChannel && !newChannel) {
                await this.handleLeave(member, oldChannel);
            } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
                await this.handleMove(member, oldChannel, newChannel);
            }
        } catch (err) {
            logger.error(`Errore log voice state: ${err.message}`);
        }
    }

    async handleJoin(member, channel) {
        const variables = {
            mention: member.toString(),
            id: member.id,
            avatar: member.user.displayAvatarURL(),
            channel: channel.toString()
        };

        await this.embedService.send(
            this.config.getChannel('voice'),
            this.config.getMessage('vc_join'),
            this.client,
            member.user,
            variables
        );
    }

    async handleLeave(member, channel) {
        const variables = {
            mention: member.toString(),
            id: member.id,
            avatar: member.user.displayAvatarURL(),
            channel: channel.toString()
        };

        await this.embedService.send(
            this.config.getChannel('voice'),
            this.config.getMessage('vc_leave'),
            this.client,
            member.user,
            variables
        );
    }

    async handleMove(member, oldChannel, newChannel) {
        const variables = {
            mention: member.toString(),
            id: member.id,
            avatar: member.user.displayAvatarURL(),
            old_channel: oldChannel.toString(),
            new_channel: newChannel.toString()
        };

        await this.embedService.send(
            this.config.getChannel('voice'),
            this.config.getMessage('vc_move'),
            this.client,
            member.user,
            variables
        );
    }
}

module.exports = VoiceEventHandler;
