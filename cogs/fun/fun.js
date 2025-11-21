const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

class FunCog {
    constructor(client) {
        this.client = client;
        this.commands = [
            new SlashCommandBuilder()
                .setName('userinfo')
                .setDescription('Mostra informazioni su un utente')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente di cui mostrare le informazioni')
                        .setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('serverinfo')
                .setDescription('Mostra informazioni sul server'),
            
            new SlashCommandBuilder()
                .setName('avatar')
                .setDescription('Mostra l\'avatar di un utente')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Utente di cui mostrare l\'avatar')
                        .setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('coinflip')
                .setDescription('Lancia una moneta'),
            
            new SlashCommandBuilder()
                .setName('roll')
                .setDescription('Tira un dado')
                .addIntegerOption(option =>
                    option.setName('max')
                        .setDescription('Numero massimo (default 6)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(1000))
        ];
    }

    async handleUserInfo(interaction) {
        const user = interaction.options.getMember('user') || interaction.member;
        const roles = user.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => role.toString()) || ['Nessun ruolo'];
        
        const embed = new EmbedBuilder()
            .setTitle(`👤 Informazioni su ${user.user.username}`)
            .setColor(user.displayColor || 0x00ff00)
            .setTimestamp()
            .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID', value: user.user.id, inline: true },
                { name: '📅 Account creato il', value: `<t:${Math.floor(user.user.createdTimestamp / 1000)}:F>`, inline: true },
                { name: '📥 Entrato nel server il', value: user.joinedAt ? `<t:${Math.floor(user.joinedTimestamp / 1000)}:F>` : 'N/A', inline: true },
                { name: '🔰 Ruoli', value: roles.join(', '), inline: false },
                { name: '🧱 È bot?', value: user.user.bot ? '✅ Sì' : '❌ No', inline: true },
                { name: '🎨 Colore ruolo', value: user.displayHexColor, inline: true }
            )
            .setFooter({ text: `Richiesto da ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    }

    async handleServerInfo(interaction) {
        const guild = interaction.guild;
        const online = guild.members.cache.filter(member => member.presence?.status !== 'offline').size;
        
        const embed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name}`)
            .setColor(0x5865F2)
            .setTimestamp()
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID Server', value: guild.id, inline: true },
                { name: '👑 Proprietario', value: `${guild.members.cache.get(guild.ownerId)?.toString() || 'N/A'}`, inline: true },
                { name: '📅 Creato il', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                { name: '👥 Membri', value: `${guild.memberCount} totali\n🟢 ${online} online`, inline: true },
                { name: '💬 Canali', value: `${guild.channels.cache.filter(c => c.type === 0).size} testo / ${guild.channels.cache.filter(c => c.type === 2).size} vocali`, inline: true },
                { name: '🎭 Ruoli', value: guild.roles.cache.size.toString(), inline: true },
                { name: '🪪 Boost Level', value: `${guild.premiumTier} (${guild.premiumSubscriptionCount} boost)`, inline: true },
                { name: '🌍 Regione', value: guild.preferredLocale.toUpperCase(), inline: true }
            )
            .setFooter({ text: `Richiesto da ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    }

    async handleAvatar(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        
        const embed = new EmbedBuilder()
            .setTitle(`Avatar di ${user.username}`)
            .setColor(Math.floor(Math.random() * 16777215))
            .setImage(user.displayAvatarURL({ dynamic: true, size: 512 }));

        await interaction.reply({ embeds: [embed] });
    }

    async handleCoinFlip(interaction) {
        const result = Math.random() < 0.5 ? '🪙 Testa' : '🪙 Croce';
        await interaction.reply({ content: result });
    }

    async handleRoll(interaction) {
        const max = interaction.options.getInteger('max') || 6;
        const result = Math.floor(Math.random() * max) + 1;
        await interaction.reply({ content: `🎲 Hai tirato un ${result}` });
    }
}

function setup(client) {
    const funCog = new FunCog(client);
    
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        
        try {
            switch (interaction.commandName) {
                case 'userinfo':
                    await funCog.handleUserInfo(interaction);
                    break;
                case 'serverinfo':
                    await funCog.handleServerInfo(interaction);
                    break;
                case 'avatar':
                    await funCog.handleAvatar(interaction);
                    break;
                case 'coinflip':
                    await funCog.handleCoinFlip(interaction);
                    break;
                case 'roll':
                    await funCog.handleRoll(interaction);
                    break;
            }
        } catch (error) {
            logger.error(`Error in fun command ${interaction.commandName}: ${error.message}`);
            
            const errorMessage = '❌ Si è verificato un errore durante l\'esecuzione del comando.';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followup.send({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...funCog.commands);

    return funCog;
}

module.exports = { setup, FunCog };