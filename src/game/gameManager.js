const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../utils/logger');
const { OWNER_ID } = require('../../utils/botUtils');
const { getConfig } = require('../core/config');
const { GameSession } = require('./GameSession');
const { activeSessions } = require('../state/sessionState');

/**
 * Controlla se ci sono abbastanza giocatori nella lobby per creare una partita
 * @param {VoiceChannel} lobbyChannel - Canale vocale della lobby
 */
async function checkAndCreateGame(lobbyChannel) {
    const guild = lobbyChannel.guild;

    if (activeSessions.has(guild.id) && activeSessions.get(guild.id).isActive) {
        return;
    }

    const members = lobbyChannel.members.filter(m => !m.user.bot);

    if (members.size >= 1) {
        logger.info('Player detected! Creating game...');
        await createGameSession(guild, lobbyChannel);
    }
}

/**
 * Crea una nuova sessione di gioco
 * @param {Guild} guild - Guild dove creare la sessione
 * @param {VoiceChannel} lobbyChannel - Canale vocale della lobby
 */
async function createGameSession(guild, lobbyChannel) {
    try {
        const config = getConfig();
        const session = new GameSession(guild, lobbyChannel);
        session.isActive = true;

        const category = config.category_id ? guild.channels.cache.get(config.category_id) : null;
        const adminUser = guild.members.cache.get(OWNER_ID);

        const overwrites = [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect]
            }
        ];

        if (adminUser) {
            overwrites.push({
                id: adminUser.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageRoles,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.Speak,
                    PermissionFlagsBits.MoveMembers
                ]
            });
        }

        const cwAllowedRoles = [
            '1426247366037602474',
            '1350073964235325562',
            '1350073966009782363'
        ];

        const textChannelOverwrites = [
            ...overwrites,
            ...cwAllowedRoles.map(roleId => ({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.SendMessages
                ]
            }))
        ];
        
        session.textChannel = await guild.channels.create({
            name: 'cw-interna',
            type: ChannelType.GuildText,
            parent: category,
            topic: 'CW - Team Rosso vs Verde',
            permissionOverwrites: textChannelOverwrites
        });

        session.redVoice = await guild.channels.create({
            name: 'Team Rosso',
            type: ChannelType.GuildVoice,
            parent: category,
            userLimit: 4,
            permissionOverwrites: overwrites
        });

        session.greenVoice = await guild.channels.create({
            name: 'Team Verde',
            type: ChannelType.GuildVoice,
            parent: category,
            userLimit: 4,
            permissionOverwrites: overwrites
        });

        const embed = new EmbedBuilder()
            .setTitle('**CW Interna** - Istruzioni')
            .setDescription('**CW Interne Valiance**\n\nTagga fino a 8 giocatori per assegnare i team automaticamente:\n> I primi 4 taggati verranno inseriti nel team ROSSO\n> Gli altri 4 nel team VERDE')
            .setColor(0x0099FF)
            .setFooter({ text: 'Usa `!cwend` per terminare la partita ed eliminare tutti i canali.' });

        await session.textChannel.send({ embeds: [embed] });
        activeSessions.set(guild.id, session);
        logger.info(`Game created successfully in server ${guild.name}`);
    } catch (error) {
        logger.error(`Error creating game: ${error.message}`);
        await cleanupSession(guild.id);
    }
}

/**
 * Pulisce e rimuove una sessione di gioco
 * @param {string} guildId - ID della guild
 */
async function cleanupSession(guildId) {
    if (!activeSessions.has(guildId)) return;

    const session = activeSessions.get(guildId);

    try {
        if (session.textChannel) {
            await session.textChannel.delete();
            logger.info('Text channel deleted');
        }
        if (session.redVoice) {
            await session.redVoice.delete();
            logger.info('Red voice channel deleted');
        }
        if (session.greenVoice) {
            await session.greenVoice.delete();
            logger.info('Green voice channel deleted');
        }

        activeSessions.delete(guildId);
        logger.info('Session cleaned up successfully');
    } catch (error) {
        logger.error(`Error during cleanup: ${error.message}`);
    }
}

module.exports = {
    checkAndCreateGame,
    createGameSession,
    cleanupSession
};
