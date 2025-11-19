const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config.json');

class CountersCog {
    constructor(client) {
        this.client = client;
        this.config = loadJsonSync(CONFIG_PATH);
        this.counterInterval = null;
    }

    startCounterLoop() {
        if (this.counterInterval) return;
        
        this.counterInterval = setInterval(async () => {
            await this.updateCounters();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        // Update immediately
        this.updateCounters();
    }

    stopCounterLoop() {
        if (this.counterInterval) {
            clearInterval(this.counterInterval);
            this.counterInterval = null;
        }
    }

    async updateCounters() {
        try {
            const activeCounters = this.config.active_counters || {};
            const countersConfig = this.config.counters || {};
            
            for (const [guildId, counters] of Object.entries(activeCounters)) {
                const guild = this.client.guilds.cache.get(guildId);
                if (!guild) continue;
                
                const totalMembers = guild.memberCount;
                let roleMembers = 0;
                
                if (countersConfig.member_role_id) {
                    const role = guild.roles.cache.get(countersConfig.member_role_id);
                    if (role) {
                        roleMembers = role.members.size;
                    }
                }
                
                // Update total members counter
                if (counters.total_members) {
                    const channel = guild.channels.cache.get(counters.total_members);
                    if (channel && channel.type === ChannelType.GuildVoice) {
                        const newName = (countersConfig.total_members_name || '👥 Membri: {count}')
                            .replace('{count}', totalMembers.toString());
                        
                        if (channel.name !== newName) {
                            try {
                                await channel.setName(newName);
                                logger.info(`Updated total members counter: ${newName}`);
                            } catch (error) {
                                logger.error(`Error updating total members counter: ${error.message}`);
                            }
                        }
                    }
                }
                
                // Update role members counter
                if (counters.role_members) {
                    const channel = guild.channels.cache.get(counters.role_members);
                    if (channel && channel.type === ChannelType.GuildVoice) {
                        const newName = (countersConfig.role_members_name || '⭐ Membri Clan: {count}')
                            .replace('{count}', roleMembers.toString());
                        
                        if (channel.name !== newName) {
                            try {
                                await channel.setName(newName);
                                logger.info(`Updated role members counter: ${newName}`);
                            } catch (error) {
                                logger.error(`Error updating role members counter: ${error.message}`);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Error in counter update loop: ${error.message}`);
        }
    }

    getCommands() {
        return [
            new SlashCommandBuilder()
                .setName('setupcounters')
                .setDescription('Configura i contatori automatici (solo admin)')
                .addChannelOption(option =>
                    option.setName('total_members')
                        .setDescription('Canale vocale per il contatore membri totali')
                        .setRequired(false))
                .addChannelOption(option =>
                    option.setName('role_members')
                        .setDescription('Canale vocale per il contatore membri con ruolo')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('member_role')
                        .setDescription('Ruolo da contare per il contatore membri clan')
                        .setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('updatecounters')
                .setDescription('Aggiorna manualmente i contatori (solo admin)')
        ];
    }

    async handleCommand(interaction) {
        const { commandName } = interaction;

        switch (commandName) {
            case 'setupcounters':
                await this.handleSetupCounters(interaction);
                break;
            case 'updatecounters':
                await this.handleUpdateCounters(interaction);
                break;
        }
    }

    async handleSetupCounters(interaction) {
        if (!ownerOrHasPermissions('Administrator')(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        const totalMembersChannel = interaction.options.getChannel('total_members');
        const roleMembersChannel = interaction.options.getChannel('role_members');
        const memberRole = interaction.options.getRole('member_role');

        let updated = [];

        if (totalMembersChannel) {
            if (totalMembersChannel.type !== ChannelType.GuildVoice) {
                await interaction.reply({ content: '❌ Il canale per i membri totali deve essere un canale vocale!', ephemeral: true });
                return;
            }
            
            if (!this.config.active_counters) this.config.active_counters = {};
            if (!this.config.active_counters[interaction.guild.id]) this.config.active_counters[interaction.guild.id] = {};
            
            this.config.active_counters[interaction.guild.id].total_members = totalMembersChannel.id;
            updated.push(`Contatore membri totali: ${totalMembersChannel.name}`);
        }

        if (roleMembersChannel) {
            if (roleMembersChannel.type !== ChannelType.GuildVoice) {
                await interaction.reply({ content: '❌ Il canale per i membri clan deve essere un canale vocale!', ephemeral: true });
                return;
            }
            
            if (!this.config.active_counters) this.config.active_counters = {};
            if (!this.config.active_counters[interaction.guild.id]) this.config.active_counters[interaction.guild.id] = {};
            
            this.config.active_counters[interaction.guild.id].role_members = roleMembersChannel.id;
            updated.push(`Contatore membri clan: ${roleMembersChannel.name}`);
        }

        if (memberRole) {
            if (!this.config.counters) this.config.counters = {};
            this.config.counters.member_role_id = memberRole.id;
            updated.push(`Ruolo membri clan: ${memberRole.name}`);
        }

        if (updated.length === 0) {
            await interaction.reply({ content: '❌ Nessuna configurazione specificata!', ephemeral: true });
            return;
        }

        saveJsonSync(CONFIG_PATH, this.config);
        
        await interaction.reply({
            content: `✅ Contatori configurati:\n${updated.map(u => `• ${u}`).join('\n')}`,
            ephemeral: true
        });

        // Update counters immediately
        await this.updateCounters();
    }

    async handleUpdateCounters(interaction) {
        if (!ownerOrHasPermissions('Administrator')(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per usare questo comando!', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        
        try {
            await this.updateCounters();
            await interaction.followup.send({ content: '✅ Contatori aggiornati con successo!', ephemeral: true });
        } catch (error) {
            await interaction.followup.send({ content: `❌ Errore nell'aggiornamento dei contatori: ${error.message}`, ephemeral: true });
        }
    }
}

function setup(client) {
    const cog = new CountersCog(client);
    
    // Register commands
    const commands = cog.getCommands();
    for (const command of commands) {
        client.application?.commands.create(command);
    }

    // Handle interactions
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isCommand()) {
            const commandNames = ['setupcounters', 'updatecounters'];
            if (commandNames.includes(interaction.commandName)) {
                await cog.handleCommand(interaction);
            }
        }
    });

    return cog;
}

module.exports = { setup, CountersCog };