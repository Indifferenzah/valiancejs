const { ActivityType } = require('discord.js');
const { getConfig } = require('../core/config');

/**
 * Aggiorna lo status del bot
 */
function updateStatus(client) {
    const config = getConfig();
    const status = config.bot_status ?? 'dnd';
    const activityType = config.bot_activity_type ?? 'watching';
    const activityName = config.bot_activity_name ?? '{membri} membri';

    let membri;
    if (config.bot_activity_guild_id) {
        const guild = client.guilds.cache.get(config.bot_activity_guild_id);
        membri = guild
            ? guild.memberCount
            : client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    } else {
        membri = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    }

    const finalActivityName = activityName.replace('{membri}', membri.toString());

    const activityMap = {
        playing: ActivityType.Playing,
        streaming: ActivityType.Streaming,
        listening: ActivityType.Listening,
        watching: ActivityType.Watching,
        competing: ActivityType.Competing
    };

    const activity = {
        name: finalActivityName,
        type: activityMap[activityType] ?? ActivityType.Watching,
        ...(activityType === 'streaming' && config.bot_activity_url
            ? { url: config.bot_activity_url }
            : {})
    };

    client.user.setPresence({
        status,
        activities: [activity]
    });
}

/**
 * Avvia l'aggiornamento periodico dello status
 */
function startStatusUpdater(client) {
    updateStatus(client);
    setInterval(() => updateStatus(client), 5 * 60 * 1000);
}

module.exports = { updateStatus, startStatusUpdater };
