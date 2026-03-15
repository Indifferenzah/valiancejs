const fs = require('fs');
const path = require('path');
const logger = require('../../../../utils/logger');
const { PATHS, ROLE_IDS, MODULE_NAME } = require('../../constants');

/**
 * Formats a single Discord message into a readable transcript line.
 * @param {import('discord.js').Message} message
 * @param {string|null} staffRoleId
 * @returns {string}
 */
function formatMessage(message, staffRoleId = null) {
    let prefix = '';
    try {
        if (message.author.id === message.client.user.id) {
            prefix = '[BOT] ';
        } else {
            const roles = message.member?.roles?.cache || new Map();
            if (staffRoleId && roles.has(staffRoleId))  prefix = '[STAFF] ';
            else if (roles.has(ROLE_IDS.CW_STAFF))      prefix = '[STAFF CW] ';
        }
    } catch { /* member may be null for deleted / left users */ }

    const parts = [];
    if (message.content?.trim()) parts.push(message.content);

    for (const embed of message.embeds) {
        const embParts = [];
        if (embed.title)       embParts.push(embed.title);
        if (embed.description) embParts.push(embed.description);
        for (const field of embed.fields) embParts.push(`${field.name}: ${field.value}`);
        if (embParts.length)   parts.push('[EMBED] ' + embParts.join(' | '));
    }

    if (message.attachments.size > 0) {
        const names = [...message.attachments.values()].map(a => a.name);
        parts.push('[ATTACHMENTS] ' + names.join(', '));
    }

    const timeStr = message.createdAt.toISOString().replace('T', ' ').split('.')[0];
    const author  = message.author.username || message.author.id;
    return `[${timeStr}] ${prefix}${author}: ${parts.join(' ') || ''}`;
}

/**
 * Fetches all messages from a channel in chronological order.
 * @param {import('discord.js').TextChannel} channel
 * @returns {Promise<import('discord.js').Message[]>}
 */
async function fetchAllMessages(channel) {
    const messages = [];
    let lastId;
    while (true) {
        const opts = { limit: 100 };
        if (lastId) opts.before = lastId;
        const fetched = await channel.messages.fetch(opts);
        if (fetched.size === 0) break;
        messages.push(...fetched.values());
        lastId = fetched.last().id;
    }
    messages.reverse();
    return messages;
}

/**
 * Saves transcript text to disk and returns the absolute file path.
 * @param {number} ticketNumber
 * @param {string} text
 * @returns {string}
 */
function saveTranscript(ticketNumber, text) {
    fs.mkdirSync(PATHS.TRANSCRIPTS, { recursive: true });
    const filename = path.join(PATHS.TRANSCRIPTS, `transcript-${ticketNumber}.txt`);
    fs.writeFileSync(filename, text, 'utf8');
    return filename;
}

/**
 * Sends a payload to the transcript log channel. Errors are logged, not thrown.
 * @param {import('discord.js').Client} client
 * @param {string} channelId
 * @param {object} payload
 */
async function sendToLogChannel(client, channelId, payload) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        logger.error(`[${MODULE_NAME}] Transcript log channel not found (${channelId})`);
        return;
    }
    await channel.send(payload).catch(err =>
        logger.error(`[${MODULE_NAME}] Error sending transcript to channel: ${err.message}`)
    );
}

/**
 * Sends a payload to a user via DM. Errors are logged, not thrown.
 * @param {import('discord.js').User} user
 * @param {object} payload
 */
async function sendToUser(user, payload) {
    try {
        await user.send(payload);
    } catch (err) {
        logger.error(`[${MODULE_NAME}] Could not send transcript DM to ${user.id}: ${err.message}`);
    }
}

module.exports = { formatMessage, fetchAllMessages, saveTranscript, sendToLogChannel, sendToUser };
