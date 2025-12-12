const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const logger = require('../../utils/logger');
const path = require('path');

class CwCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'cw.json');
        this.config = this.loadConfig();
        
        this.commands = [
            new SlashCommandBuilder()
                .setName('cw')
                .setDescription('Invia punteggio CW')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addIntegerOption(option => option.setName('numero').setDescription('Numero CW').setRequired(true))
                .addStringOption(option => option.setName('data').setDescription('Data (DD/MM/YYYY)').setRequired(true))
                .addStringOption(option => option.setName('ora').setDescription('Ora (HH:MM)').setRequired(true))
                .addStringOption(option => option.setName('rossi').setDescription('Team Rosso').setRequired(true))
                .addStringOption(option => option.setName('verdi').setDescription('Team Verde').setRequired(true))
                .addStringOption(option => option.setName('mappa').setDescription('Mappa giocata').setRequired(true))
                .addStringOption(option => option.setName('recap').setDescription('Link recap').setRequired(true))
                .addStringOption(option => option.setName('vincitore').setDescription('Vincitore (rosso/verde)').setRequired(true)
                    .addChoices(
                        { name: 'Team Rosso', value: 'rosso' },
                        { name: 'Team Verde', value: 'verde' }
                    ))
        ];
    }

    loadConfig() {
        return loadJsonSync(this.configPath, {
            cw_channel_id: "",
            cw_results: []
        });
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    reloadConfig() {
        this.config = this.loadConfig();
    }

    async handleCw(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        const numero = interaction.options.getInteger('numero');
        const data = interaction.options.getString('data');
        const ora = interaction.options.getString('ora');
        const rossi = interaction.options.getString('rossi');
        const verdi = interaction.options.getString('verdi');
        const mappa = interaction.options.getString('mappa');
        const recap = interaction.options.getString('recap');
        const vincitore = interaction.options.getString('vincitore');

        const winnerColor = vincitore === 'rosso' ? 0xff0000 : 0x00ff00;
        const winnerEmoji = vincitore === 'rosso' ? '🔴' : '🟢';
        const winnerTeam = vincitore === 'rosso' ? 'Team Rosso' : 'Team Verde';

        const embed = new EmbedBuilder()
            .setTitle(`⚔️ CW #${numero} - Risultato`)
            .setDescription(`**${winnerEmoji} Vincitore: ${winnerTeam}**`)
            .addFields(
                { name: '📅 Data e Ora', value: `${data} alle ${ora}`, inline: true },
                { name: '🗺️ Mappa', value: mappa, inline: true },
                { name: '🔗 Recap', value: `[Guarda il recap](${recap})`, inline: true },
                { name: '🔴 Team Rosso', value: rossi, inline: true },
                { name: '🟢 Team Verde', value: verdi, inline: true },
                { name: '\u200b', value: '\u200b', inline: true }
            )
            .setColor(winnerColor)
            .setFooter({ text: 'Valiance | CW Results' })
            .setTimestamp();

        const result = {
            numero,
            data,
            ora,
            rossi,
            verdi,
            mappa,
            recap,
            vincitore,
            timestamp: Date.now()
        };

        this.config.cw_results.push(result);
        this.saveConfig();

        await interaction.reply({ embeds: [embed] });
        logger.info(`CW #${numero} result posted by ${interaction.user.tag}: ${winnerTeam} won`);
    }
}

function setup(client) {
    const cwCog = new CwCog(client);
    
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        
        if (interaction.commandName === 'cw') {
            try {
                await cwCog.handleCw(interaction);
            } catch (error) {
                logger.error(`Error in CW command: ${error.message}`);
                if (!interaction.replied) {
                    await interaction.reply({ content: '❌ Errore nel comando CW.', ephemeral: true });
                }
            }
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cwCog.commands);
    return cwCog;
}

module.exports = { setup, CwCog };