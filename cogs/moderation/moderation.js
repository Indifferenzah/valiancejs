const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContextMenuCommandBuilder,
    ApplicationCommandType
} = require('discord.js');

const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');
const path = require('path');

const {
    handleBan,
    handleUnban,
    handleUnbanAutocomplete,
    handleKick,
    handleMute,
    handleUnmute,
    handleNick
} = require('./handlers/actionHandlers');

const {
    handleUserContext,
    handleModerationModal
} = require('./handlers/contextMenuHandlers');

const { MODULE_NAME } = require('./constants');

class ModerationCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'moderation.json');
        this.config = this._loadConfig();
        this.commands = this._registerSlashCommands();
        this.contextMenus = this._registerContextMenus();

        logger.info(`[${MODULE_NAME}] Moderation system initialized successfully.`);
    }

    _loadConfig() {
        return loadJsonSync(this.configPath, {
            staff_role_id: "1350073958933729371",
            mod_role_id: "1350073957168058408",
            warn_channel_id: "1351184266284896347",
            no_automod: ["1350073967716732971", "1364656451779428462"]
        });
    }

    reloadConfig() {
        this.config = this._loadConfig();
        logger.info(`[${MODULE_NAME}] Configuration reloaded successfully.`);
    }

    _registerSlashCommands() {
        return [
            new SlashCommandBuilder()
                .setName('ban')
                .setDescription('🔨 Banna permanentemente un membro dal server')
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Membro da bannare')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Motivo del ban')
                        .setRequired(false)
                        .setMaxLength(500)
                ),

            new SlashCommandBuilder()
                .setName('kick')
                .setDescription('👢 Rimuovi un membro dal server')
                .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Membro da kickare')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Motivo del kick')
                        .setRequired(false)
                        .setMaxLength(500)
                ),

            new SlashCommandBuilder()
                .setName('unban')
                .setDescription('♻️ Sbanna un utente tramite ID')
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID utente da sbannare')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Motivo dello sban')
                        .setRequired(false)
                        .setMaxLength(500)
                ),

            new SlashCommandBuilder()
                .setName('mute')
                .setDescription('🔇 Metti temporaneamente in timeout un membro')
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Membro da mettere in timeout')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Durata (es: 10m, 1h, 1d)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Motivo del timeout')
                        .setRequired(false)
                        .setMaxLength(500)
                ),

            new SlashCommandBuilder()
                .setName('unmute')
                .setDescription('🔊 Rimuovi il timeout da un membro')
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Membro da smutare')
                        .setRequired(true)
                ),

            new SlashCommandBuilder()
                .setName('nick')
                .setDescription('✏️ Cambia il nickname di un membro')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Membro a cui cambiare il nickname')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('nick')
                        .setDescription('Nuovo nickname')
                        .setRequired(true)
                        .setMaxLength(32)
                )
        ];
    }

    _registerContextMenus() {
        return [
            new ContextMenuCommandBuilder()
                .setName('Ban')
                .setType(ApplicationCommandType.User),

            new ContextMenuCommandBuilder()
                .setName('Kick')
                .setType(ApplicationCommandType.User),

            new ContextMenuCommandBuilder()
                .setName('Timeout')
                .setType(ApplicationCommandType.User)
        ];
    }
}

function setup(client) {
    logger.info(`[${MODULE_NAME}] Initializing Moderation System...`);

    const moderationCog = new ModerationCog(client);

    client.on('interactionCreate', async (interaction) => {
        try {
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('mod_')) {
                    return handleModerationModal(interaction);
                }
                return;
            }

            if (interaction.isAutocomplete()) {
                if (interaction.commandName === 'unban') {
                    const focused = interaction.options.getFocused(true);
                    if (focused.name === 'id') {
                        return handleUnbanAutocomplete(interaction);
                    }
                }
                return;
            }

            if (interaction.isUserContextMenuCommand()) {
                return handleUserContext(interaction);
            }

            if (!interaction.isChatInputCommand()) return;

            switch (interaction.commandName) {
                case 'ban':
                    return handleBan(interaction);

                case 'kick':
                    return handleKick(interaction);

                case 'mute':
                    return handleMute(interaction);

                case 'unmute':
                    return handleUnmute(interaction);

                case 'unban':
                    return handleUnban(interaction);

                case 'nick':
                    return handleNick(interaction);

                default:
                    break;
            }
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Error handling interaction:`, error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Si è verificato un errore inaspettato durante l\'elaborazione della richiesta.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });

    if (!client.globalCommands) {
        client.globalCommands = [];
    }

    client.globalCommands.push(
        ...moderationCog.commands,
        ...moderationCog.contextMenus
    );

    logger.info(`[${MODULE_NAME}] Moderation System initialized successfully.`);

    return moderationCog;
}

module.exports = { setup, ModerationCog };

