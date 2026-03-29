'use strict';

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Slash commands del sistema di logging
 */

const commands = [
    new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Mostra l\'ultimo messaggio eliminato in questo canale'),

    new SlashCommandBuilder()
        .setName('editsnipe')
        .setDescription('Mostra l\'ultimo messaggio modificato in questo canale'),

    new SlashCommandBuilder()
        .setName('voicestats')
        .setDescription('Mostra le statistiche vocali di un utente')
        .addUserOption(opt =>
            opt.setName('utente')
                .setDescription('Utente di cui vedere le statistiche (default: te)')
                .setRequired(false)
        )
        .addIntegerOption(opt =>
            opt.setName('giorni')
                .setDescription('Numero di giorni da considerare (default: 7)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(30)
        ),

    new SlashCommandBuilder()
        .setName('voiceleaderboard')
        .setDescription('Classifica degli utenti per tempo trascorso in vocale questa settimana'),

    new SlashCommandBuilder()
        .setName('watchlist')
        .setDescription('Gestisci la watchlist degli utenti monitorati')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Aggiungi un utente alla watchlist')
                .addUserOption(opt =>
                    opt.setName('utente')
                        .setDescription('Utente da monitorare')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('motivo')
                        .setDescription('Motivo del monitoraggio')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Rimuovi un utente dalla watchlist')
                .addUserOption(opt =>
                    opt.setName('utente')
                        .setDescription('Utente da rimuovere')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Mostra tutti gli utenti monitorati')
        ),

    new SlashCommandBuilder()
        .setName('history')
        .setDescription('Mostra la cronologia dei cambiamenti di username/avatar di un utente')
        .addUserOption(opt =>
            opt.setName('utente')
                .setDescription('Utente di cui vedere la storia')
                .setRequired(true)
        )
];

module.exports = commands;
