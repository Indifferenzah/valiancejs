const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const logger = require('../../utils/logger');
const path = require('path');

class AutoRoleCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'autorole.json');
        this.config = this.loadConfig();
        
        this.commands = [
            new SlashCommandBuilder()
                .setName('createreact')
                .setDescription('Crea messaggio reazione ruoli')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ID del messaggio')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Emoji da usare')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Ruolo da assegnare')
                        .setRequired(true))
        ];
    }

    loadConfig() {
        return loadJsonSync(this.configPath, {});
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    reloadConfig() {
        this.config = this.loadConfig();
        logger.info('AutoRole config reloaded');
    }

    async handleCreateReact(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
            return;
        }

        const messageId = interaction.options.getString('message_id');
        const emoji = interaction.options.getString('emoji');
        const role = interaction.options.getRole('role');

        try {
            const message = await interaction.channel.messages.fetch(messageId);
            
            await message.react(emoji);
            
            if (!this.config[interaction.guild.id]) {
                this.config[interaction.guild.id] = {};
            }
            
            if (!this.config[interaction.guild.id][messageId]) {
                this.config[interaction.guild.id][messageId] = {};
            }
            
            this.config[interaction.guild.id][messageId][emoji] = role.id;
            this.saveConfig();

            const embed = new EmbedBuilder()
                .setTitle('✅ Reaction Role Creato')
                .setDescription(`Reaction role configurato con successo!\n\n**Messaggio:** ${messageId}\n**Emoji:** ${emoji}\n**Ruolo:** ${role.toString()}`)
                .setColor(0x00ff00)
                .setFooter({ text: 'Valiance Bot | AutoRole System' });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            logger.info(`Reaction role created by ${interaction.user.tag}: ${emoji} -> ${role.name}`);
        } catch (error) {
            await interaction.reply({ content: `❌ Errore: ${error.message}`, ephemeral: true });
            logger.error(`Error creating reaction role: ${error.message}`);
        }
    }

    async handleReactionAdd(reaction, user) {
        if (user.bot) return;

        const guild = reaction.message.guild;
        if (!guild) return;

        const guildConfig = this.config[guild.id];
        if (!guildConfig) return;

        const messageConfig = guildConfig[reaction.message.id];
        if (!messageConfig) return;

        const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
        const roleId = messageConfig[emoji];
        
        if (!roleId) return;

        try {
            const member = await guild.members.fetch(user.id);
            const role = guild.roles.cache.get(roleId);
            
            if (role && !member.roles.cache.has(roleId)) {
                await member.roles.add(role, 'AutoRole - Reaction added');
                logger.info(`Added role ${role.name} to ${user.tag} via reaction`);
            }
        } catch (error) {
            logger.error(`Error adding role via reaction: ${error.message}`);
        }
    }

    async handleReactionRemove(reaction, user) {
        if (user.bot) return;

        const guild = reaction.message.guild;
        if (!guild) return;

        const guildConfig = this.config[guild.id];
        if (!guildConfig) return;

        const messageConfig = guildConfig[reaction.message.id];
        if (!messageConfig) return;

        const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
        const roleId = messageConfig[emoji];
        
        if (!roleId) return;

        try {
            const member = await guild.members.fetch(user.id);
            const role = guild.roles.cache.get(roleId);
            
            if (role && member.roles.cache.has(roleId)) {
                await member.roles.remove(role, 'AutoRole - Reaction removed');
                logger.info(`Removed role ${role.name} from ${user.tag} via reaction`);
            }
        } catch (error) {
            logger.error(`Error removing role via reaction: ${error.message}`);
        }
    }
}

function setup(client) {
    const autoRoleCog = new AutoRoleCog(client);
    
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        
        if (interaction.commandName === 'createreact') {
            await autoRoleCog.handleCreateReact(interaction);
        }
    });

    client.on('messageReactionAdd', async (reaction, user) => {
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                logger.error('Something went wrong when fetching the reaction:', error);
                return;
            }
        }
        
        await autoRoleCog.handleReactionAdd(reaction, user);
    });

    client.on('messageReactionRemove', async (reaction, user) => {
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                logger.error('Something went wrong when fetching the reaction:', error);
                return;
            }
        }
        
        await autoRoleCog.handleReactionRemove(reaction, user);
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...autoRoleCog.commands);

    return autoRoleCog;
}

module.exports = { setup, AutoRoleCog };