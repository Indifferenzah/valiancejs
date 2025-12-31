const Formatters = require('../core/Formatters');
const logger = require('../../../utils/logger');

class MemberEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('guildMemberAdd', this.handleMemberAdd.bind(this));
        this.client.on('guildMemberRemove', this.handleMemberRemove.bind(this));
    }

    async handleMemberAdd(member) {
        try {
            await new Promise(r => setTimeout(r, 5000));

            const variables = {
                mention: member.toString(),
                username: member.user.username,
                id: member.user.id,
                avatar: member.user.displayAvatarURL(),
                created_at: Formatters.formatDateTime(member.user.createdAt),
                joined_at: Formatters.formatDateTime(member.joinedAt),
                total_members: member.guild.memberCount.toString()
            };

            await this.embedService.send(
                this.config.getChannel('join'),
                this.config.getMessage('join'),
                this.client,
                member.user,
                variables
            );
        } catch (err) {
            logger.error(`Errore log join: ${err.message}`);
        }
    }

    async handleMemberRemove(member) {
        try {
            await new Promise(r => setTimeout(r, 5000));

            const leftAt = new Date();
            const timeInServer = Formatters.formatTimeDelta(member.joinedAt, leftAt);
            const roles = Formatters.getRolesString(member);

            const variables = {
                mention: member.toString(),
                username: member.user.username,
                id: member.user.id,
                avatar: member.user.displayAvatarURL(),
                created_at: Formatters.formatDateTime(member.user.createdAt),
                left_at: Formatters.formatDateTime(leftAt),
                time_in_server: timeInServer,
                roles: roles,
                total_members: member.guild.memberCount.toString()
            };

            await this.embedService.send(
                this.config.getChannel('leave'),
                this.config.getMessage('leave'),
                this.client,
                member.user,
                variables
            );
        } catch (err) {
            logger.error(`Errore log leave: ${err.message}`);
        }
    }
}

module.exports = MemberEventHandler;
