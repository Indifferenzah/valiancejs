const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const logger = require('../../utils/logger');
const path = require('path');

class RegoleCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'regole.json');
        this.config = this.loadConfig();
        
        this.commands = [
            new SlashCommandBuilder()
                .setName('regole')
                .setDescription('Manda le regole del server')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        ];
    }

    loadConfig() {
        return loadJsonSync(this.configPath, {
            title: "📋 Regole del Server",
            description: "Ecco le regole del server che tutti devono rispettare:",
            color: 0x00ff00,
            rules: [
                "1️⃣ Rispetta tutti i membri",
                "2️⃣ Non fare spam",
                "3️⃣ Usa i canali appropriati",
                "4️⃣ Non condividere contenuti inappropriati",
                "5️⃣ Segui le istruzioni dello staff"
            ],
            footer: "Valiance | Regole del Server",
            thumbnail: ""
        });
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    reloadConfig() {
        this.config = this.loadConfig();
        logger.info('Regole config reloaded');
    }

    async handleRegole(interaction) {
        const embed = new EmbedBuilder()
            .setTitle(this.config.title)
            .setDescription(this.config.description)
            .setColor(this.config.color);

        if (this.config.rules && this.config.rules.length > 0) {
            embed.addFields({
                name: 'Regole',
                value: this.config.rules.join('\n'),
                inline: false
            });
        }

        if (this.config.thumbnail) {
            embed.setThumbnail(this.config.thumbnail);
        }

        if (this.config.footer) {
            embed.setFooter({ text: this.config.footer });
        }

        await interaction.reply({ embeds: [embed] });
        logger.info(`/regole used by ${interaction.user.tag} in ${interaction.guild.name}`);
    }
}

function setup(client) {
    const regoleCog = new RegoleCog(client);
    
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        
        if (interaction.commandName === 'regole') {
            await regoleCog.handleRegole(interaction);
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...regoleCog.commands);

    return regoleCog;
}

module.exports = { setup, RegoleCog };