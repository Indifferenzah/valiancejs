const logger = require('../../utils/logger');
const { getConfig } = require('../core/config');
const { checkAndCreateGame } = require('../game/gameManager');
const { cleanupSession } = require('../game/gameManager');
const { activeSessions } = require('../state/sessionState');

/**
 * Handler per l'evento voiceStateUpdate
 */
async function onVoiceStateUpdate(client, oldState, newState) {
    if (newState.member.user.bot) return;

    const config = getConfig();
    const lobbyId = config.lobby_voice_channel_id;

    if (newState.channel && newState.channel.id === lobbyId) {
        await checkAndCreateGame(newState.channel);
        return;
    }

    try {
        let leftChannel = null;
        if (oldState.channel && (!newState.channel || oldState.channel.id !== newState.channel.id)) {
            leftChannel = oldState.channel;
        }

        if (leftChannel) {
            for (const [guildId, session] of activeSessions) {
                if ((session.redVoice && session.redVoice.id === leftChannel.id) ||
                    (session.greenVoice && session.greenVoice.id === leftChannel.id)) {
                
                    const redEmpty = !session.redVoice || session.redVoice.members.filter(m => !m.user.bot).size === 0;
                    const greenEmpty = !session.greenVoice || session.greenVoice.members.filter(m => !m.user.bot).size === 0;

                    if (redEmpty && greenEmpty) {
                        await cleanupSession(guildId);
                    }
                    break;
                }
            }
        }
    } catch (error) {
        logger.error(`Error in voice state cleanup: ${error.message}`);
    }
}

module.exports = { onVoiceStateUpdate };
