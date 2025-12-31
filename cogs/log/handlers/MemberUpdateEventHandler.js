const { AuditLogEvent } = require('discord.js');
const AuditService = require('../services/AuditService');
const logger = require('../../../utils/logger');

class MemberUpdateEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('guildMemberUpdate', this.handleMemberUpdate.bind(this));
    }

    async handleMemberUpdate(oldMember, newMember) {
        try {
            if (!oldMember || !newMember) return;

            await this.handleBoost(oldMember, newMember);
            await this.handleRoleChanges(oldMember, newMember);
        } catch (err) {
            logger.error(`Errore log member update: ${err.message}`);
        }
    }

    async handleBoost(oldMember, newMember) {
        const oldBoost = oldMember.premiumSince;
        const newBoost = newMember.premiumSince;
        
        if (!oldBoost && newBoost) {
            const variables = {
                mention: newMember.toString(),
                id: newMember.id,
                avatar: newMember.user.displayAvatarURL()
            };

            await this.embedService.send(
                this.config.getChannel('boost'),
                this.config.getMessage('boost'),
                this.client,
                newMember.user,
                variables
            );
        }
    }

    async handleRoleChanges(oldMember, newMember) {
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
        const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

        if (addedRoles.size === 0 && removedRoles.size === 0) return;

        const guild = newMember.guild;
        const staffer = await AuditService.getExecutor(AuditLogEvent.MemberRoleUpdate, newMember.id, guild);

        const variables = {
            mention: newMember.toString(),
            id: newMember.id,
            avatar: newMember.user.displayAvatarURL(),
            staffer,
            total_members: guild.memberCount.toString(),
            added_roles: addedRoles.map(r => `<@&${r.id}>`).join(' ') || 'Nessuno',
            removed_roles: removedRoles.map(r => `<@&${r.id}>`).join(' ') || 'Nessuno'
        };

        await this.embedService.send(
            this.config.getChannel('moderation'),
            this.config.getMessage('role_change'),
            this.client,
            newMember.user,
            variables
        );
    }
}

module.exports = MemberUpdateEventHandler;
