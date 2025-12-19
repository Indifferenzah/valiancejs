const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CoralMC = require('coralmc');
const logger = require('../../utils/logger');

class CoralMCCog {
    constructor(client) {
        this.client = client;

        this.commands = [
            new SlashCommandBuilder()
                .setName('coralmc')
                .setDescription('Comandi CoralMC')

                /* ================= PLAYER ================= */
                .addSubcommand(sub =>
                    sub
                        .setName('player_info')
                        .setDescription('Info player CoralMC')
                        .addStringOption(o =>
                            o.setName('player').setDescription('Nome player').setRequired(true)
                        )
                )

                .addSubcommand(sub =>
                    sub
                        .setName('player_stats')
                        .setDescription('Statistiche player CoralMC')
                        .addStringOption(o =>
                            o.setName('player').setDescription('Nome player').setRequired(true)
                        )
                )

                .addSubcommand(sub =>
                    sub
                        .setName('player_matches')
                        .setDescription('Ultimi match del player')
                        .addStringOption(o =>
                            o.setName('player').setDescription('Nome player').setRequired(true)
                        )
                )

                /* ================= MATCH ================= */
                .addSubcommand(sub =>
                    sub
                        .setName('match_info')
                        .setDescription('Info match tramite ID')
                        .addStringOption(o =>
                            o.setName('id').setDescription('ID match').setRequired(true)
                        )
                )

                .addSubcommand(sub =>
                    sub
                        .setName('match_last')
                        .setDescription('Ultimo match di un player')
                        .addStringOption(o =>
                            o.setName('player').setDescription('Nome player').setRequired(true)
                        )
                )

                /* ================= ALTRO ================= */
                .addSubcommand(sub =>
                    sub
                        .setName('leaderboard')
                        .setDescription('Leaderboard CoralMC')
                )

                .addSubcommand(sub =>
                    sub
                        .setName('status')
                        .setDescription('Stato network CoralMC')
                )
        ];
    }

    /* =====================================================
       HANDLERS
    ===================================================== */

    async handlePlayerInfo(interaction) {
        const player = interaction.options.getString('player');
        const info = await CoralMC.getPlayerInfo(player);

        if (!info) {
            return interaction.reply({ content: '❌ Player non trovato.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${player}`)
            .setColor(0x3498db)
            .setTimestamp();

        Object.entries(info).forEach(([k, v]) => {
            embed.addFields({
                name: k.replace(/_/g, ' ').toUpperCase(),
                value: String(v),
                inline: true
            });
        });

        logger.info(`[coralmcCog] info player ${player}`);
        await interaction.reply({ embeds: [embed] });
    }

    async handlePlayerStats(interaction) {
        const player = interaction.options.getString('player');
        const stats = await CoralMC.getPlayerStats(player);

        if (!stats) {
            return interaction.reply({ content: '❌ Statistiche non trovate.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`📊 Stats — ${player}`)
            .setColor(0x2ecc71)
            .setTimestamp();

        Object.entries(stats).forEach(([k, v]) => {
            embed.addFields({
                name: k.replace(/_/g, ' ').toUpperCase(),
                value: String(v),
                inline: true
            });
        });

        logger.info(`[coralmcCog] stats player ${player}`);
        await interaction.reply({ embeds: [embed] });
    }

    async handlePlayerMatches(interaction) {
        const player = interaction.options.getString('player');
        const matches = await CoralMC.getPlayerMatches(player);

        if (!matches || !matches.length) {
            return interaction.reply({ content: '❌ Nessun match trovato.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎮 Ultimi match — ${player}`)
            .setColor(0xe67e22)
            .setTimestamp();

        matches.slice(0, 5).forEach(m => {
            embed.addFields({
                name: `Match ${m.id}`,
                value: `Mode: ${m.mode}\nRisultato: ${m.result}`,
                inline: false
            });
        });

        logger.info(`[coralmcCog] matches player ${player}`);
        await interaction.reply({ embeds: [embed] });
    }

    async handleMatchInfo(interaction) {
        const id = interaction.options.getString('id');
        const match = await CoralMC.getMatch(id);

        if (!match) {
            return interaction.reply({ content: '❌ Match non trovato.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏟 Match ${id}`)
            .setColor(0x9b59b6)
            .setTimestamp();

        Object.entries(match).forEach(([k, v]) => {
            embed.addFields({
                name: k.toUpperCase(),
                value: String(v),
                inline: true
            });
        });

        logger.info(`[coralmcCog] match info ${id}`);
        await interaction.reply({ embeds: [embed] });
    }

    async handleMatchLast(interaction) {
        const player = interaction.options.getString('player');
        const match = await CoralMC.getLastMatch(player);

        if (!match) {
            return interaction.reply({ content: '❌ Nessun match trovato.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`⏱ Ultimo match — ${player}`)
            .setColor(0x1abc9c)
            .setTimestamp();

        Object.entries(match).forEach(([k, v]) => {
            embed.addFields({
                name: k.toUpperCase(),
                value: String(v),
                inline: true
            });
        });

        logger.info(`[coralmcCog] last match ${player}`);
        await interaction.reply({ embeds: [embed] });
    }

    async handleLeaderboard(interaction) {
        const lb = await CoralMC.getLeaderboard();

        if (!lb) {
            return interaction.reply({ content: '❌ Leaderboard non disponibile.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 Leaderboard CoralMC')
            .setColor(0xf1c40f)
            .setTimestamp();

        lb.slice(0, 10).forEach((p, i) => {
            embed.addFields({
                name: `#${i + 1} ${p.player}`,
                value: `Punti: ${p.points}`,
                inline: false
            });
        });

        logger.info('[coralmcCog] leaderboard');
        await interaction.reply({ embeds: [embed] });
    }

    async handleStatus(interaction) {
        const status = await CoralMC.getNetworkStatus?.();

        const embed = new EmbedBuilder()
            .setTitle('🌐 Stato CoralMC')
            .setColor(0x95a5a6)
            .setTimestamp();

        if (!status) {
            embed.setDescription('⚠️ Stato non disponibile');
        } else {
            Object.entries(status).forEach(([k, v]) => {
                embed.addFields({
                    name: k.toUpperCase(),
                    value: String(v),
                    inline: true
                });
            });
        }

        logger.info('[coralmcCog] status');
        await interaction.reply({ embeds: [embed] });
    }
}

/* =====================================================
   SETUP (IDENTICO AL TUO MODERATION)
===================================================== */

function setup(client) {
    const coralmcCog = new CoralMCCog(client);

    client.on('interactionCreate', async interaction => {
        try {
            if (!interaction.isChatInputCommand()) return;
            if (interaction.commandName !== 'coralmc') return;

            const sub = interaction.options.getSubcommand();

            switch (sub) {
                case 'player_info': return coralmcCog.handlePlayerInfo(interaction);
                case 'player_stats': return coralmcCog.handlePlayerStats(interaction);
                case 'player_matches': return coralmcCog.handlePlayerMatches(interaction);
                case 'match_info': return coralmcCog.handleMatchInfo(interaction);
                case 'match_last': return coralmcCog.handleMatchLast(interaction);
                case 'leaderboard': return coralmcCog.handleLeaderboard(interaction);
                case 'status': return coralmcCog.handleStatus(interaction);
            }
        } catch (err) {
            logger.error(`[coralmcCog] ${err.message}`);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Errore CoralMC.', ephemeral: true });
            }
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...coralmcCog.commands);

    return coralmcCog;
}

module.exports = { setup, CoralMCCog };
