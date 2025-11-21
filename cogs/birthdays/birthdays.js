const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');
const path = require('path');

class BirthdaysCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'config.json');
        this.dataPath = path.join(__dirname, '../../data/birthdays.json');
        this.config = this.loadConfig();
        this.birthdays = this.loadBirthdays();
        
        this.commands = [
            new SlashCommandBuilder()
                .setName('birthday')
                .setDescription('Comandi per i compleanni')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('set')
                        .setDescription('Imposta il tuo compleanno')
                        .addStringOption(option =>
                            option.setName('date')
                                .setDescription('Data del compleanno (formato: DD/MM)')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Rimuovi il tuo compleanno'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('when')
                        .setDescription('Mostra il compleanno di un utente')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('Utente di cui vedere il compleanno')
                                .setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('next')
                        .setDescription('Mostra i prossimi compleanni'))
        ];
    }

    loadConfig() {
        return loadJsonSync(this.configPath, {});
    }

    loadBirthdays() {
        return loadJsonSync(this.dataPath, {});
    }

    saveBirthdays() {
        saveJsonSync(this.dataPath, this.birthdays);
    }

    parseDate(dateStr) {
        const parts = dateStr.split('/');
        if (parts.length !== 2) return null;
        
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        
        if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
            return null;
        }
        
        return { day, month };
    }

    formatDate(day, month) {
        return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
    }

    getDaysUntilBirthday(day, month) {
        const now = new Date();
        const currentYear = now.getFullYear();
        let birthday = new Date(currentYear, month - 1, day);
        
        if (birthday < now) {
            birthday = new Date(currentYear + 1, month - 1, day);
        }
        
        const diffTime = birthday - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    async handleBirthdaySet(interaction) {
        const dateStr = interaction.options.getString('date');
        const parsed = this.parseDate(dateStr);
        
        if (!parsed) {
            await interaction.reply({ 
                content: '❌ Formato data non valido! Usa il formato DD/MM (es: 15/03)', 
                ephemeral: true 
            });
            return;
        }

        const userId = interaction.user.id;
        this.birthdays[userId] = {
            day: parsed.day,
            month: parsed.month,
            username: interaction.user.username
        };
        
        this.saveBirthdays();

        const embed = new EmbedBuilder()
            .setTitle('🎂 Compleanno Impostato!')
            .setDescription(`Il tuo compleanno è stato impostato al **${this.formatDate(parsed.day, parsed.month)}**`)
            .setColor(0xFF69B4)
            .setFooter({ text: 'Valiance Bot | Birthday System' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
        logger.info(`Birthday set for ${interaction.user.tag}: ${this.formatDate(parsed.day, parsed.month)}`);
    }

    async handleBirthdayRemove(interaction) {
        const userId = interaction.user.id;
        
        if (!this.birthdays[userId]) {
            await interaction.reply({ 
                content: '❌ Non hai impostato nessun compleanno!', 
                ephemeral: true 
            });
            return;
        }

        delete this.birthdays[userId];
        this.saveBirthdays();

        await interaction.reply({ 
            content: '✅ Il tuo compleanno è stato rimosso!', 
            ephemeral: true 
        });
        logger.info(`Birthday removed for ${interaction.user.tag}`);
    }

    async handleBirthdayWhen(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const birthday = this.birthdays[user.id];
        
        if (!birthday) {
            const target = user.id === interaction.user.id ? 'Non hai' : `${user.username} non ha`;
            await interaction.reply({ 
                content: `❌ ${target} impostato nessun compleanno!`, 
                ephemeral: true 
            });
            return;
        }

        const daysUntil = this.getDaysUntilBirthday(birthday.day, birthday.month);
        const dateStr = this.formatDate(birthday.day, birthday.month);
        
        let description;
        if (daysUntil === 0) {
            description = `🎉 **Oggi è il compleanno di ${user.username}!** 🎉`;
        } else if (daysUntil === 1) {
            description = `🎂 Il compleanno di ${user.username} è **domani** (${dateStr})!`;
        } else {
            description = `🎂 Il compleanno di ${user.username} è il **${dateStr}** (tra ${daysUntil} giorni)`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎂 Compleanno')
            .setDescription(description)
            .setColor(0xFF69B4)
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: 'Valiance Bot | Birthday System' });

        await interaction.reply({ embeds: [embed] });
    }

    async handleBirthdayNext(interaction) {
        const allBirthdays = Object.entries(this.birthdays)
            .map(([userId, data]) => ({
                userId,
                ...data,
                daysUntil: this.getDaysUntilBirthday(data.day, data.month)
            }))
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .slice(0, 10);

        if (allBirthdays.length === 0) {
            await interaction.reply({ 
                content: '❌ Nessun compleanno registrato!', 
                ephemeral: true 
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎂 Prossimi Compleanni')
            .setColor(0xFF69B4)
            .setFooter({ text: 'Valiance Bot | Birthday System' });

        let description = '';
        for (const birthday of allBirthdays) {
            const dateStr = this.formatDate(birthday.day, birthday.month);
            const user = await this.client.users.fetch(birthday.userId).catch(() => null);
            const username = user ? user.username : birthday.username;
            
            if (birthday.daysUntil === 0) {
                description += `🎉 **${username}** - Oggi!\n`;
            } else if (birthday.daysUntil === 1) {
                description += `🎂 **${username}** - Domani (${dateStr})\n`;
            } else {
                description += `🎂 **${username}** - ${dateStr} (tra ${birthday.daysUntil} giorni)\n`;
            }
        }

        embed.setDescription(description);
        await interaction.reply({ embeds: [embed] });
    }
}

function setup(client) {
    const birthdaysCog = new BirthdaysCog(client);
    
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        
        if (interaction.commandName === 'birthday') {
            const subcommand = interaction.options.getSubcommand();
            
            try {
                switch (subcommand) {
                    case 'set':
                        await birthdaysCog.handleBirthdaySet(interaction);
                        break;
                    case 'remove':
                        await birthdaysCog.handleBirthdayRemove(interaction);
                        break;
                    case 'when':
                        await birthdaysCog.handleBirthdayWhen(interaction);
                        break;
                    case 'next':
                        await birthdaysCog.handleBirthdayNext(interaction);
                        break;
                }
            } catch (error) {
                logger.error(`Error in birthday command ${subcommand}: ${error.message}`);
                
                const errorMessage = '❌ Si è verificato un errore durante l\'esecuzione del comando.';
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followup.send({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...birthdaysCog.commands);

    return birthdaysCog;
}

module.exports = { setup, BirthdaysCog };