const { PermissionFlagsBits } = require('discord.js');

const OWNER_ID = '1123622103917285418';

function isOwner(userOrId) {
    try {
        if (typeof userOrId === 'string') {
            return userOrId === OWNER_ID;
        }
        return userOrId?.id === OWNER_ID;
    } catch (error) {
        return false;
    }
}

function ownerOrHasPermissions(...perms) {
    return function(interaction) {
        try {
            if (isOwner(interaction.user)) {
                return true;
            }
            
            const userPerms = interaction.member.permissions;
            for (const perm of perms) {
                if (!userPerms.has(perm)) {
                    return false;
                }
            }
            return true;
        } catch (error) {
            return false;
        }
    };
}

module.exports = {
    OWNER_ID,
    isOwner,
    ownerOrHasPermissions
};