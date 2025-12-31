const logger = require('../../../utils/logger');

class UserEventHandler {
    constructor(client, config, embedService) {
        this.client = client;
        this.config = config;
        this.embedService = embedService;
    }

    register() {
        this.client.on('userUpdate', this.handleUserUpdate.bind(this));
        this.client.on('presenceUpdate', this.handlePresenceUpdate.bind(this));
    }

    async handleUserUpdate(oldUser, newUser) {
        try {
            if (newUser.bot) return;

            let changed = false;
            let changes = [];

            if (oldUser.username !== newUser.username) {
                changed = true;
                changes.push(`Username: \`${oldUser.username}\` → \`${newUser.username}\``);
            }

            if (oldUser.avatar !== newUser.avatar) {
                changed = true;
                changes.push('Avatar aggiornato');
            }

            if (!changed) return;

            const variables = {
                user: newUser.toString(),
                id: newUser.id,
                changes: changes.join('\n'),
                avatar: newUser.displayAvatarURL()
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('user_update'),
                this.client,
                newUser,
                variables
            );
        } catch (err) {
            logger.error(`Errore log user update: ${err.message}`);
        }
    }

    async handlePresenceUpdate(oldPresence, newPresence) {
        try {
            if (!newPresence || !newPresence.user || newPresence.user.bot) return;

            const oldStatus = oldPresence?.status || 'offline';
            const newStatus = newPresence.status || 'offline';

            if (oldStatus === newStatus) return;

            const variables = {
                user: newPresence.user.toString(),
                old_status: oldStatus,
                new_status: newStatus
            };

            await this.embedService.send(
                this.config.getChannel('guildlog'),
                this.config.getMessage('presence_update'),
                this.client,
                newPresence.user,
                variables
            );
        } catch (err) {
            logger.error(`Errore log presence update: ${err.message}`);
        }
    }
}

module.exports = UserEventHandler;
