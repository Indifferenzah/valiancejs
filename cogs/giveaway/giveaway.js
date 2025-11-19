const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const logger = require('../../utils/logger');
const path = require('path');

class GiveawayCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'giveaway.json');
        this.blacklistPath = path.join(__dirname, 'blacklist.json');
        this.config = this.loadConfig();
        this.blacklist = this.loadBlacklist();
        this.activeGiveaways = new Map();
        
        this.commands = [
            new SlashCommandBuilder()
                .setName('giveaway')
                .setDescription('Sistema giveaway')
                .addSubcommand(subcommand =>
                    subcommand.setName('create')
                        .setDescription('Crea un giveaway')
                        .addStringOption(option => option.setName('prize').setDescription('Premio del giveaway').setRequired(true))
                        .addStringOption(option => option.setName('duration').setDescription('Durata (es: 1h, 30m, 1d)').setRequired(true))
                        .addIntegerOption(option => option.setName('winners').setDescription('Numero vincitori (default: 1)').setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand.setName('end')
                        .setDescription('Termina un giveaway')
                        .addStringOption(option => option.setName('message_id').setDescription('ID messaggio giveaway').setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand.setName('reroll')
                        .setDescription('Riestrai vincitori')
                        .addStringOption(option => option.setName('message_id').setDescription('ID messaggio giveaway').setRequired(true)))
                .addSubcommandGroup(group =>
                    group.setName('blacklist')
                        .setDescription('Gestisci blacklist giveaway')
                        .addSubcommand(subcommand =>
                            subcommand.setName('add')
                                .setDescription('Aggiungi utente alla blacklist')
                                .addUserOption(option => option.setName('user').setDescription('Utente').setRequired(true)))
                        .addSubcommand(subcommand =>
                            subcommand.setName('remove')
                                .setDescription('Rimuovi utente dalla blacklist')
                                .addUserOption(option => option.setName('user').setDescription('Utente').setRequired(true)))
                        .addSubcommand(subcommand =>
                            subcommand.setName('list')
                                .setDescription('Mostra blacklist')))
        ];
    }

    loadConfig() {
        return loadJsonSync(this.configPath, { giveaways: {} });
    }

    loadBlacklist() {
        return loadJsonSync(this.blacklistPath, { users: [] });
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    saveBlacklist() {
        saveJsonSync(this.blacklistPath, this.blacklist);
    }

    parseDuration(duration) {
        const match = duration.match(/^(\d+)([smhd])$/);
        if (!match) return null;
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return null;
        }
    }

    async handleGiveawayCreate(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi!', ephemeral: true });
            return;
        }

        const prize = interaction.options.getString('prize');
        const duration = interaction.options.getString('duration');
        const winners = interaction.options.getInteger('winners') || 1;

        const ms = this.parseDuration(duration);
        if (!ms) {
            await interaction.reply({ content: '❌ Durata non valida! Usa formato: 1h, 30m, 1d', ephemeral: true });
            return;
        }

        const endTime = Date.now() + ms;
        const embed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY!')
            .setDescription(`**Premio:** ${prize}\n**Vincitori:** ${winners}\n**Termina:** <t:${Math.floor(endTime / 1000)}:R>`)
            .setColor(0x00ff00)
            .setFooter({ text: 'Clicca 🎉 per partecipare!' });

        const button = new ButtonBuilder()
            .setCustomId('giveaway_join')
            .setLabel('Partecipa')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎉');

        const row = new ActionRowBuilder().addComponents(button);
        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Store giveaway data
        this.config.giveaways[message.id] = {
            prize,
            winners,
            endTime,
            participants: [],
            channelId: interaction.channel.id,
            hostId: interaction.user.id
        };
        this.saveConfig();

        // Set timeout to end giveaway
        setTimeout(() => this.endGiveaway(message.id), ms);
        
        logger.info(`Giveaway created by ${interaction.user.tag}: ${prize}`);
    }

    async handleGiveawayEnd(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi!', ephemeral: true });
            return;
        }

        const messageId = interaction.options.getString('message_id');
        await this.endGiveaway(messageId);
        await interaction.reply({ content: '✅ Giveaway terminato!', ephemeral: true });
    }

    async endGiveaway(messageId) {
        const giveaway = this.config.giveaways[messageId];
        if (!giveaway) return;

        try {
            const channel = this.client.channels.cache.get(giveaway.channelId);
            const message = await channel.messages.fetch(messageId);

            const validParticipants = giveaway.participants.filter(id => !this.blacklist.users.includes(id));
            
            if (validParticipants.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Giveaway Terminato')
                    .setDescription(`**Premio:** ${giveaway.prize}\n\n❌ Nessun partecipante valido!`)
                    .setColor(0xff0000);

                await message.edit({ embeds: [embed], components: [] });
                return;
            }

            const winners = [];
            for (let i = 0; i < Math.min(giveaway.winners, validParticipants.length); i++) {
                const randomIndex = Math.floor(Math.random() * validParticipants.length);
                const winnerId = validParticipants.splice(randomIndex, 1)[0];
                winners.push(winnerId);
            }

            const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
            
            const embed = new EmbedBuilder()
                .setTitle('🎉 Giveaway Terminato')
                .setDescription(`**Premio:** ${giveaway.prize}\n\n🏆 **Vincitori:** ${winnerMentions}`)
                .setColor(0xffd700);

            await message.edit({ embeds: [embed], components: [] });
            await channel.send(`🎉 Congratulazioni ${winnerMentions}! Avete vinto: **${giveaway.prize}**`);

            delete this.config.giveaways[messageId];
            this.saveConfig();
        } catch (error) {
            logger.error(`Error ending giveaway ${messageId}: ${error.message}`);
        }
    }

    async handleGiveawayJoin(interaction) {
        const messageId = interaction.message.id;
        const giveaway = this.config.giveaways[messageId];
        
        if (!giveaway) {
            await interaction.reply({ content: '❌ Giveaway non trovato!', ephemeral: true });
            return;
        }

        if (this.blacklist.users.includes(interaction.user.id)) {
            await interaction.reply({ content: '❌ Sei nella blacklist dei giveaway!', ephemeral: true });
            return;
        }

        if (giveaway.participants.includes(interaction.user.id)) {
            await interaction.reply({ content: '❌ Stai già partecipando!', ephemeral: true });
            return;
        }

        giveaway.participants.push(interaction.user.id);
        this.saveConfig();

        await interaction.reply({ content: '✅ Partecipazione registrata!', ephemeral: true });
    }

    async handleBlacklistAdd(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi!', ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user');
        
        if (this.blacklist.users.includes(user.id)) {
            await interaction.reply({ content: '❌ Utente già nella blacklist!', ephemeral: true });
            return;
        }

        this.blacklist.users.push(user.id);
        this.saveBlacklist();

        await interaction.reply({ content: `✅ ${user.tag} aggiunto alla blacklist giveaway.`, ephemeral: true });
    }

    async handleBlacklistRemove(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi!', ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user');
        const index = this.blacklist.users.indexOf(user.id);
        
        if (index === -1) {
            await interaction.reply({ content: '❌ Utente non nella blacklist!', ephemeral: true });
            return;
        }

        this.blacklist.users.splice(index, 1);
        this.saveBlacklist();

        await interaction.reply({ content: `✅ ${user.tag} rimosso dalla blacklist giveaway.`, ephemeral: true });
    }

    async handleBlacklistList(interaction) {
        if (this.blacklist.users.length === 0) {
            await interaction.reply({ content: 'Blacklist vuota.', ephemeral: true });
            return;
        }

        const users = await Promise.all(
            this.blacklist.users.map(async id => {
                try {
                    const user = await this.client.users.fetch(id);
                    return user.tag;
                } catch {
                    return `ID: ${id}`;
                }
            })
        );

        const embed = new EmbedBuilder()
            .setTitle('🚫 Blacklist Giveaway')
            .setDescription(users.join('\n'))
            .setColor(0xff0000);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

function setup(client) {
    const giveawayCog = new GiveawayCog(client);
    
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton() && interaction.customId === 'giveaway_join') {
            await giveawayCog.handleGiveawayJoin(interaction);
            return;
        }
        
        if (!interaction.isChatInputCommand()) return;
        
        if (interaction.commandName === 'giveaway') {
            try {
                const subcommandGroup = interaction.options.getSubcommandGroup();
                const subcommand = interaction.options.getSubcommand();
                
                if (subcommandGroup === 'blacklist') {
                    switch (subcommand) {
                        case 'add': await giveawayCog.handleBlacklistAdd(interaction); break;
                        case 'remove': await giveawayCog.handleBlacklistRemove(interaction); break;
                        case 'list': await giveawayCog.handleBlacklistList(interaction); break;
                    }
                } else {
                    switch (subcommand) {
                        case 'create': await giveawayCog.handleGiveawayCreate(interaction); break;
                        case 'end': await giveawayCog.handleGiveawayEnd(interaction); break;
                        case 'reroll': await giveawayCog.handleGiveawayEnd(interaction); break;
                    }
                }
            } catch (error) {
                logger.error(`Error in giveaway command: ${error.message}`);
                if (!interaction.replied) {
                    await interaction.reply({ content: '❌ Errore nel comando giveaway.', ephemeral: true });
                }
            }
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...giveawayCog.commands);
    return giveawayCog;
}

module.exports = { setup, GiveawayCog };