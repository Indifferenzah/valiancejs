const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

function getCommands() {
    return [
        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Crea un pannello per i ticket di supporto')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName('close')
            .setDescription('Avvia la procedura di chiusura del ticket'),

        new SlashCommandBuilder()
            .setName('rename')
            .setDescription('Rinomina il canale ticket')
            .addStringOption(o =>
                o.setName('nome')
                    .setDescription('Il nuovo nome del canale (max 100 caratteri)')
                    .setRequired(true)),

        new SlashCommandBuilder()
            .setName('blacklist')
            .setDescription('Aggiungi/rimuovi un utente dalla blacklist dei ticket')
            .addUserOption(o =>
                o.setName('member')
                    .setDescription('Utente da blacklistare / de-blacklistare')
                    .setRequired(true)),

        new SlashCommandBuilder()
            .setName('add')
            .setDescription('Aggiungi un utente o un ruolo al ticket')
            .addUserOption(o =>
                o.setName('utente')
                    .setDescription('Utente da aggiungere')
                    .setRequired(false))
            .addRoleOption(o =>
                o.setName('ruolo')
                    .setDescription('Ruolo da aggiungere')
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('remove')
            .setDescription('Rimuovi un utente o un ruolo dal ticket')
            .addUserOption(o =>
                o.setName('member')
                    .setDescription('Utente da rimuovere')
                    .setRequired(false))
            .addRoleOption(o =>
                o.setName('ruolo')
                    .setDescription('Ruolo da rimuovere')
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('list')
            .setDescription('Mostra i ticket aperti e chiusi di un utente')
            .addUserOption(o =>
                o.setName('user')
                    .setDescription('Utente di cui mostrare i ticket')
                    .setRequired(true)),

        new SlashCommandBuilder()
            .setName('transcript')
            .setDescription('Invia il transcript di un ticket chiuso')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addIntegerOption(o =>
                o.setName('number')
                    .setDescription('Numero del ticket')
                    .setRequired(true)),

        new SlashCommandBuilder()
            .setName('sendtranscript')
            .setDescription('Manda via DM il transcript di un ticket chiuso a un utente')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addIntegerOption(o =>
                o.setName('number')
                    .setDescription('Numero del ticket')
                    .setRequired(true))
            .addUserOption(o =>
                o.setName('user')
                    .setDescription('Utente a cui inviare il transcript')
                    .setRequired(true)),
    ];
}

module.exports = { getCommands };
