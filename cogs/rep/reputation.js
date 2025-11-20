const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');
const path = require('path');

class ReputationCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'config.json');
        this.config = this.loadConfig();
        this.cooldowns = new Map();
        
        this.commands = [
            new SlashCommandBuilder()
                .setName('rep')
                .setDescription('Sistema di reputazione')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Aggiungi reputation (+rep)')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('Utente a cui dare reputation')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('reason')
                                .setDescription('Motivo (opzionale)')
                                .setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Rimuovi reputation (-rep)')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('Utente a cui rimuovere reputation')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('reason')
                                .setDescription('Motivo (opzionale)')
                                .setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('show')
                        .setDescription('Mostra reputation di un utente')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('Utente di cui vedere la reputation')
                                .setRequired(false)))
        ];
    }

    loadConfig() {
        return loadJsonSync(this.configPath, {
            cooldown_hours: 24,
            reputation_data: {}
        });
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    getUserReputation(userId) {
        if (!this.config.reputation_data[userId]) {
            this.config.reputation_data[userId] = {
                positive: 0,
                negative: 0,
                total: 0,
                given_by: [],
                history: []
            };
        }
        return this.config.reputation_data[userId];
    }

    canGiveReputation(giverId, receiverId) {
        if (giverId === receiverId) {
            return { canGive: false, reason: 'Non puoi dare reputation a te stesso!' };
        }

        const cooldownKey = `${giverId}-${receiverId}`;
        const lastGiven = this.cooldowns.get(cooldownKey);
        
        if (lastGiven) {
            const hoursAgo = (Date.now() - lastGiven) / (1000 * 60 * 60);
            if (hoursAgo < this.config.cooldown_hours) {
                const remaining = Math.ceil(this.config.cooldown_hours - hoursAgo);
                return { 
                    canGive: false, 
                    reason: `Devi aspettare ancora ${remaining} ore prima di dare reputation a questo utente!` 
                };
            }
        }

        return { canGive: true };
    }

    applyReputation(giver, receiver, reason, type) {
        const canGive = this.canGiveReputation(giver.id, receiver.id);
        if (!canGive.canGive) {
            return { error: canGive.reason };
        }

        const userRep = this.getUserReputation(receiver.id);
        const isPositive = type === 'positive';
        if (isPositive) {
            userRep.positive += 1;
            userRep.total += 1;
        } else {
            userRep.negative += 1;
            userRep.total -= 1;
        }
        userRep.history.push({
            type,
            from: giver.id,
            from_username: giver.username,
            reason,
            timestamp: Date.now()
        });

        this.cooldowns.set(`${giver.id}-${receiver.id}`, Date.now());
        this.saveConfig();

        const embed = new EmbedBuilder()
            .setTitle(isPositive ? '✅ Reputation Aggiunta!' : '❌ Reputation Rimossa!')
            .setDescription(`Hai dato **${isPositive ? '+1' : '-1'} reputation** a ${receiver.toString()}`)
            .addFields(
                { name: '📝 Motivo', value: reason, inline: false },
                { name: '📊 Reputation Totale', value: `${userRep.total} (${userRep.positive}+ / ${userRep.negative}-)`, inline: true }
            )
            .setColor(isPositive ? 0x00ff00 : 0xff0000)
            .setThumbnail(receiver.displayAvatarURL())
            .setFooter({ text: 'Valiance Bot | Reputation System' });

        return { embed };
    }

    async handleRepAdd(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'Nessun motivo specificato';

        const res = this.applyReputation(interaction.user, user, reason, 'positive');
        if (res.error) {
            await interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });
            return;
        }
        await interaction.reply({ embeds: [res.embed] });
        logger.info(`+rep given by ${interaction.user.tag} to ${user.tag}: ${reason}`);
    }

    async handleRepRemove(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'Nessun motivo specificato';

        const res = this.applyReputation(interaction.user, user, reason, 'negative');
        if (res.error) {
            await interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });
            return;
        }
        await interaction.reply({ embeds: [res.embed] });
        logger.info(`-rep given by ${interaction.user.tag} to ${user.tag}: ${reason}`);
    }

    async handleRepShow(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const userRep = this.getUserReputation(user.id);

        let color = 0x808080;
        if (userRep.total > 0) color = 0x00ff00;
        else if (userRep.total < 0) color = 0xff0000;

        const embed = new EmbedBuilder()
            .setTitle(`?? Reputation di ${user.username}`)
            .setDescription(`**Reputation Totale:** ${userRep.total}`)
            .addFields(
                { name: '? Positive', value: userRep.positive.toString(), inline: true },
                { name: '? Negative', value: userRep.negative.toString(), inline: true },
                { name: '?? Totale', value: userRep.total.toString(), inline: true }
            )
            .setColor(color)
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: 'Valiance Bot | Reputation System' });

        if (userRep.history.length > 0) {
            const recentHistory = userRep.history
                .slice(-5)
                .reverse()
                .map(entry => {
                    const type = entry.type === 'positive' ? '✅' : '❌';
                    const date = new Date(entry.timestamp).toLocaleDateString();
                    return `${type} **${entry.from_username}** - ${entry.reason} (${date})`;
                })
                .join('\n');

            embed.addFields({
                name: '🕑 Storia Recente',
                value: recentHistory,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

}

function setup(client) {
    const reputationCog = new ReputationCog(client);
    

    if (!client.repPrefixListener) {
        client.repPrefixListener = true;
        client.on('messageCreate', async (message) => {
            try {
                if (message.author.bot || !message.guild) return;
                const content = message.content.trim();
                const isPositive = content.startsWith('+rep');
                const isNegative = content.startsWith('-rep');
            if (!isPositive && !isNegative) return;

            const parts = content.split(/\s+/);
            if (parts.length < 2) {
                await message.reply('Usa +rep/-rep @utente [motivo].');
                return;
            }

            let target = message.mentions.users.first();
            if (!target) {
                const possibleId = parts[1].replace(/[^0-9]/g, '');
                if (possibleId) {
                    try {
                        target = await message.client.users.fetch(possibleId);
                    } catch (error) {
                        target = null;
                    }
                }
            }

            if (!target) {
                await message.reply('❌ Utente non valido.');
                return;
            }

            const reason = parts.slice(2).join(' ') || 'Nessun motivo specificato';
            const res = reputationCog.applyReputation(message.author, target, reason, isPositive ? 'positive' : 'negative');
            if (res.error) {
                await message.reply(`❌ ${res.error}`);
                return;
            }

            await message.reply({ embeds: [res.embed] });
            logger.info(`${isPositive ? '+rep' : '-rep'} via prefix by ${message.author.tag} to ${target.tag}: ${reason}`);
        } catch (error) {
            logger.error(`Error in rep prefix handler: ${error.message}`);
        }
    });
    }

    // Register command handlers
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        
        if (interaction.commandName === 'rep') {
            const subcommand = interaction.options.getSubcommand();
            
            try {
                switch (subcommand) {
                    case 'add':
                        await reputationCog.handleRepAdd(interaction);
                        break;
                    case 'remove':
                        await reputationCog.handleRepRemove(interaction);
                        break;
                    case 'show':
                        await reputationCog.handleRepShow(interaction);
                        break;
                }
            } catch (error) {
                logger.error(`Error in rep command ${subcommand}: ${error.message}`);
                
                const errorMessage = '❌ Si è verificato un errore durante l\'esecuzione del comando.';
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followup.send({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        }
    });

    // Add commands to global commands array
    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...reputationCog.commands);

    return reputationCog;
}

module.exports = { setup, ReputationCog };
