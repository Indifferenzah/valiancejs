const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');

const deepl = require('deepl-node');
const path = require('path');
const { loadJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');

class TraduttoreCog {
    constructor(client) {
        this.client = client;

        this.configPath = path.join(__dirname, 'traduttore.json');
        this.config = loadJsonSync(this.configPath, {});

        if (!process.env.DEEPL_KEY) {
            throw new Error('❌ Errore: DEEPL_KEY non trovata.');
        }

        this.translator = new deepl.Translator(process.env.DEEPL_KEY);

        this.commands = [
            new SlashCommandBuilder()
                .setName('traduci')
                .setDescription('Traduce un messaggio con DeepL')
                .addStringOption(opt =>
                    opt
                        .setName('mess')
                        .setDescription('Testo da tradurre')
                        .setRequired(true)
                )
                .addStringOption(opt => {
                    opt
                        .setName('lingua')
                        .setDescription('Lingua di destinazione')
                        .setRequired(true);

                    for (const lang of this.config.languages) {
                        opt.addChoices({
                            name: lang.label,
                            value: lang.value
                        });
                    }

                    return opt;
                })
        ];
    }

    async handleTranslate(interaction) {
        const text = interaction.options.getString('mess');
        const targetLang = interaction.options.getString('lingua');

        await interaction.deferReply();

        try {
            const result = await this.translator.translateText(
                text,
                null,
                targetLang
            );

            const detected = result.detectedSourceLang || 'AUTO';
            const embedCfg = this.config.embed || {};

            const embed = new EmbedBuilder()
                .setColor(embedCfg.color || 0x3498db)
                .setAuthor({
                    name: interaction.user.username,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setDescription(
                    `📝 **Testo originale (${detected})**\n` +
                    `\`\`\`\n${text}\n\`\`\`\n` +
                    `🌐 **Traduzione (${targetLang})**\n` +
                    `\`\`\`\n${result.text}\n\`\`\``
                )
                .setThumbnail(embedCfg.thumbnail || null)
                .setFooter({
                    text: embedCfg.footer_text || 'DeepL',
                    iconURL: interaction.guild.iconURL() || undefined
                });

            await interaction.editReply({ embeds: [embed] });
            logger.info(`[DEEPL] Messaggio tradotto.`)

        } catch (error) {
            console.error('[DEEPL ERROR]', error);
            await interaction.editReply({
                content: '❌ Errore durante la traduzione.'
            });
        }
    }
}

function setup(client) {
    const cog = new TraduttoreCog(client);

    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'traduci') {
            return cog.handleTranslate(interaction);
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.commands);

    return cog;
}

module.exports = { setup, TraduttoreCog };
