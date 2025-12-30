const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
process.env.FFMPEG_PATH = ffmpegInstaller.path;

const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();

/**
 * Inizializza e configura il client Discord
 * @returns {Client} Client Discord configurato
 */
function createClient() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessageReactions
        ]
    });

    client.setMaxListeners(20);

    client.commands = new Collection();
    client.cogs = new Collection();

    return client;
}

module.exports = { createClient };
