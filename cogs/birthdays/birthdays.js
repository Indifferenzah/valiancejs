const { SlashCommandBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const path = require('path');

const ConfigManager = require('./core/ConfigManager');
const BirthdayService = require('./services/BirthdayService');
const NotificationService = require('./services/NotificationService');
const SchedulerService = require('./services/SchedulerService');
const CommandHandler = require('./handlers/CommandHandler');

class BirthdaysCog {
    constructor(client) {
        this.client = client;
        this.name = 'birthdays';

        this.configPath = path.join(__dirname, 'config.json');
        this.dataPath = path.join(__dirname, '../../data/birthdays.json');

        this.configManager = new ConfigManager(this.configPath);
        
        this.initializeServices();
        this.initializeHandlers();
        this.initializeScheduler();

        this.commands = this.buildCommands();

        logger.info('[BIRTHDAYS] Sistema compleanni enterprise-level inizializzato');
    }

    initializeServices() {
        this.birthdayService = new BirthdayService(this.dataPath);

        const config = {
            notifications: this.configManager.getNotificationConfig(),
            messages: this.configManager.getMessagesConfig()
        };
        
        this.notificationService = new NotificationService(this.client, config);

        logger.info('[BIRTHDAYS] Servizi inizializzati');
    }

    initializeHandlers() {
        this.commandHandler = new CommandHandler(this.birthdayService);
        logger.info('[BIRTHDAYS] Handlers inizializzati');
    }

    initializeScheduler() {
        this.schedulerService = new SchedulerService(
            this.client,
            this.birthdayService,
            this.notificationService,
            this.configManager
        );

        this.schedulerService.start();
        logger.info('[BIRTHDAYS] Scheduler avviato');
    }

    buildCommands() {
        return [
            new SlashCommandBuilder()
                .setName('birthday')
                .setDescription('Gestione compleanni')
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

    async handleCommand(interaction) {
        await this.commandHandler.execute(interaction);
    }

    reload() {
        this.configManager.reload();

        const config = {
            notifications: this.configManager.getNotificationConfig(),
            messages: this.configManager.getMessagesConfig()
        };

        this.notificationService.updateConfig(config);
        
        logger.info('[BIRTHDAYS] Configurazione ricaricata');
    }

    getStats() {
        return {
            enabled: this.configManager.isEnabled(),
            totalBirthdays: this.birthdayService.getBirthdayCount(),
            todayBirthdays: this.birthdayService.getTodaysBirthdays().length,
            schedulerStatus: this.schedulerService.getStatus()
        };
    }

    async forceCheck() {
        await this.schedulerService.forceCheck();
    }

    shutdown() {
        this.schedulerService.stop();
        logger.info('[BIRTHDAYS] Sistema compleanni arrestato');
    }
}

function setup(client) {
    const birthdaysCog = new BirthdaysCog(client);

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'birthday') {
            await birthdaysCog.handleCommand(interaction);
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...birthdaysCog.commands);

    logger.info('[BIRTHDAYS] Cog setup completato');
    return birthdaysCog;
}

module.exports = { setup };
