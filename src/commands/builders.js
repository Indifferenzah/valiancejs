const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits } = require('discord.js');

/**
 * Definizioni dei comandi slash
 */
const commands = [
    new SlashCommandBuilder()
        .setName('cwend')
        .setDescription('Termina la partita custom e elimina i canali (solo admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('setruleset')
        .setDescription('Imposta il ruleset (solo per admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('ruleset')
        .setDescription('Mostra il ruleset salvato'),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Elimina un numero di messaggi (1-250)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Numero di messaggi da eliminare (1-250)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(250)),
    
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Mostra la latenza del bot'),
    
    new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Mostra da quanto tempo il bot è online'),
    
    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Crea e modifica un embed in tempo reale (solo admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Comandi di verifica')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Invia il pannello di verifica con pulsante (solo admin)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('forceverify')
                .setDescription('Verifica forzatamente un membro (solo admin)')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Membro da verificare forzatamente')
                        .setRequired(true))),
];

/**
 * Definizioni dei context menu
 */
const contextMenus = [
    new ContextMenuCommandBuilder()
        .setName('Force Verify')
        .setType(ApplicationCommandType.User)
];

module.exports = { commands, contextMenus };
