const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');
const path = require('path');

class MarriageCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'config.json');
        this.config = this.loadConfig();
        
        this.commands = [
            new SlashCommandBuilder()
                .setName('marry')
                .setDescription('Sposa un utente')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente da sposare')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('divorce')
                .setDescription('Divorzia da un utente')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente da cui divorziare')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('relationship')
                .setDescription('Mostra le relazioni di un utente')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente di cui vedere le relazioni')
                        .setRequired(false))
        ];
    }

    loadConfig() {
        return loadJsonSync(this.configPath, {
            marriages: {}
        });
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    isMarried(userId) {
        return this.config.marriages[userId] || null;
    }

    async handleMarry(interaction) {
        const user = interaction.options.getUser('user');
        
        if (user.id === interaction.user.id) {
            await interaction.reply({ content: '❌ Non puoi sposare te stesso!', ephemeral: true });
            return;
        }

        if (user.bot) {
            await interaction.reply({ content: '❌ Non puoi sposare un bot!', ephemeral: true });
            return;
        }

        const userMarriage = this.isMarried(interaction.user.id);
        const targetMarriage = this.isMarried(user.id);

        if (userMarriage) {
            const spouse = await this.client.users.fetch(userMarriage.spouse_id).catch(() => null);
            const spouseName = spouse ? spouse.username : 'Utente sconosciuto';
            await interaction.reply({ 
                content: `❌ Sei già sposato/a con **${spouseName}**! Divorzia prima di risposare.`, 
                ephemeral: true 
            });
            return;
        }

        if (targetMarriage) {
            const spouse = await this.client.users.fetch(targetMarriage.spouse_id).catch(() => null);
            const spouseName = spouse ? spouse.username : 'Utente sconosciuto';
            await interaction.reply({ 
                content: `❌ **${user.username}** è già sposato/a con **${spouseName}**!`, 
                ephemeral: true 
            });
            return;
        }

        // Create marriage
        const marriageData = {
            spouse_id: user.id,
            spouse_username: user.username,
            married_at: Date.now(),
            married_by: interaction.user.id
        };

        this.config.marriages[interaction.user.id] = {
            ...marriageData,
            spouse_id: user.id,
            spouse_username: user.username
        };

        this.config.marriages[user.id] = {
            ...marriageData,
            spouse_id: interaction.user.id,
            spouse_username: interaction.user.username
        };

        this.saveConfig();

        const embed = new EmbedBuilder()
            .setTitle('💒 Matrimonio!')
            .setDescription(`🎉 **${interaction.user.username}** e **${user.username}** si sono sposati! 🎉`)
            .setColor(0xFF69B4)
            .addFields({
                name: '💕 Data del matrimonio',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            })
            .setFooter({ text: 'Valiance Bot | Marriage System' });

        await interaction.reply({ embeds: [embed] });
        logger.info(`Marriage created: ${interaction.user.tag} married ${user.tag}`);
    }

    async handleDivorce(interaction) {
        const user = interaction.options.getUser('user');
        
        const userMarriage = this.isMarried(interaction.user.id);
        
        if (!userMarriage) {
            await interaction.reply({ content: '❌ Non sei sposato/a con nessuno!', ephemeral: true });
            return;
        }

        if (userMarriage.spouse_id !== user.id) {
            await interaction.reply({ 
                content: `❌ Non sei sposato/a con **${user.username}**!`, 
                ephemeral: true 
            });
            return;
        }

        // Remove marriages
        delete this.config.marriages[interaction.user.id];
        delete this.config.marriages[user.id];
        this.saveConfig();

        const embed = new EmbedBuilder()
            .setTitle('💔 Divorzio!')
            .setDescription(`😢 **${interaction.user.username}** e **${user.username}** hanno divorziato...`)
            .setColor(0x808080)
            .setFooter({ text: 'Valiance Bot | Marriage System' });

        await interaction.reply({ embeds: [embed] });
        logger.info(`Divorce: ${interaction.user.tag} divorced ${user.tag}`);
    }

    async handleRelationship(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const marriage = this.isMarried(user.id);

        const embed = new EmbedBuilder()
            .setTitle(`💕 Relazioni di ${user.username}`)
            .setColor(0xFF69B4)
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: 'Valiance Bot | Marriage System' });

        if (!marriage) {
            embed.setDescription('💔 Questo utente è single');
        } else {
            const spouse = await this.client.users.fetch(marriage.spouse_id).catch(() => null);
            const spouseName = spouse ? spouse.username : marriage.spouse_username;
            const marriedDate = new Date(marriage.married_at);
            
            embed.setDescription(`💒 Sposato/a con **${spouseName}**`)
                .addFields({
                    name: '💕 Data del matrimonio',
                    value: `<t:${Math.floor(marriage.married_at / 1000)}:F>`,
                    inline: false
                });
        }

        await interaction.reply({ embeds: [embed] });
    }
}

function setup(client) {
    const marriageCog = new MarriageCog(client);
    
    // Register command handlers
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        
        try {
            switch (interaction.commandName) {
                case 'marry':
                    await marriageCog.handleMarry(interaction);
                    break;
                case 'divorce':
                    await marriageCog.handleDivorce(interaction);
                    break;
                case 'relationship':
                    await marriageCog.handleRelationship(interaction);
                    break;
            }
        } catch (error) {
            logger.error(`Error in marriage command ${interaction.commandName}: ${error.message}`);
            
            const errorMessage = '❌ Si è verificato un errore durante l\'esecuzione del comando.';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followup.send({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    });

    // Add commands to global commands array
    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...marriageCog.commands);

    return marriageCog;
}

module.exports = { setup, MarriageCog };