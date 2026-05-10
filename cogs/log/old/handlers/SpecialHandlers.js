const logger = require('../../../utils/logger');

class AutoModEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleAutoModRuleCreate(rule) {
        const eventLogger = this.loggerFactory.getLogger('autoModerationRuleCreate');
        if (!eventLogger) return;

        await eventLogger.log(rule.guild.id, {
            title: 'Regola AutoMod Creata',
            description: `È stata creata una nuova regola di AutoMod: **${rule.name}**`,
            fields: [
                { name: 'Nome', value: rule.name, inline: true },
                { name: 'ID', value: rule.id, inline: true },
                { name: 'Abilitata', value: rule.enabled ? 'Sì' : 'No', inline: true },
                { name: 'Tipo Evento', value: this.getEventType(rule.eventType), inline: true },
                { name: 'Tipo Trigger', value: this.getTriggerType(rule.triggerType), inline: true },
                { name: 'Creatore', value: rule.creatorId ? `<@${rule.creatorId}>` : 'Sconosciuto', inline: true },
                { name: 'Azioni', value: this.formatActions(rule.actions), inline: false },
                { name: 'Canali Esenti', value: rule.exemptChannels.size > 0 ? `${rule.exemptChannels.size}` : 'Nessuno', inline: true },
                { name: 'Ruoli Esenti', value: rule.exemptRoles.size > 0 ? `${rule.exemptRoles.size}` : 'Nessuno', inline: true }
            ]
        });
    }

    async handleAutoModRuleUpdate(oldRule, newRule) {
        const eventLogger = this.loggerFactory.getLogger('autoModerationRuleUpdate');
        if (!eventLogger) return;

        const changes = eventLogger.getDifferences(oldRule, newRule, [
            { key: 'name', name: 'Nome' },
            { key: 'enabled', name: 'Abilitata' },
            { key: 'eventType', name: 'Tipo Evento' },
            { key: 'triggerType', name: 'Tipo Trigger' }
        ]);

        if (changes.length === 0) return;

        await eventLogger.log(newRule.guild.id, {
            title: 'Regola AutoMod Aggiornata',
            description: `La regola **${newRule.name}** è stata modificata`,
            fields: [
                { name: 'Regola', value: newRule.name, inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                ...changes
            ]
        });
    }

    async handleAutoModRuleDelete(rule) {
        const eventLogger = this.loggerFactory.getLogger('autoModerationRuleDelete');
        if (!eventLogger) return;

        await eventLogger.log(rule.guild.id, {
            title: 'Regola AutoMod Eliminata',
            description: `La regola **${rule.name}** è stata eliminata`,
            fields: [
                { name: 'Nome', value: rule.name, inline: true },
                { name: 'ID', value: rule.id, inline: true }
            ],
            color: '#F04747'
        });
    }

    async handleAutoModActionExecution(execution) {
        const eventLogger = this.loggerFactory.getLogger('autoModerationActionExecution');
        if (!eventLogger) return;

        await eventLogger.log(execution.guild.id, {
            title: 'Azione AutoMod Eseguita',
            description: `AutoMod ha eseguito un'azione su ${execution.user}`,
            fields: [
                { name: 'Utente', value: `${execution.user.tag} (<@${execution.userId}>)`, inline: true },
                { name: 'Canale', value: `<#${execution.channelId}>`, inline: true },
                { name: 'Regola', value: execution.ruleTriggerType ? this.getTriggerType(execution.ruleTriggerType) : 'Sconosciuta', inline: true },
                { name: 'Azione', value: this.getActionType(execution.action.type), inline: true },
                { name: 'Contenuto', value: eventLogger.truncate(execution.content || 'Nessuno', 1024), inline: false },
                { name: 'Matched Keyword', value: execution.matchedKeyword || 'N/A', inline: true }
            ],
            thumbnail: execution.user.displayAvatarURL({ dynamic: true }),
            color: '#F04747'
        });
    }

    getEventType(type) {
        const types = {
            1: 'Invio Messaggio'
        };
        return types[type] || `Sconosciuto (${type})`;
    }

    getTriggerType(type) {
        const types = {
            1: 'Keyword',
            3: 'Spam',
            4: 'Keyword Preset',
            5: 'Mention Spam'
        };
        return types[type] || `Sconosciuto (${type})`;
    }

    getActionType(type) {
        const types = {
            1: 'Blocca Messaggio',
            2: 'Invia Alert',
            3: 'Timeout'
        };
        return types[type] || `Sconosciuto (${type})`;
    }

    formatActions(actions) {
        if (!actions || actions.length === 0) return 'Nessuna';
        return actions.map(action => this.getActionType(action.type)).join(', ');
    }
}

class StageEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleStageInstanceCreate(stageInstance) {
        const eventLogger = this.loggerFactory.getLogger('stageInstanceCreate');
        if (!eventLogger) return;

        await eventLogger.log(stageInstance.guild.id, {
            title: 'Stage Creato',
            description: `È stato avviato uno stage: **${stageInstance.topic}**`,
            fields: [
                { name: 'Argomento', value: stageInstance.topic, inline: true },
                { name: 'ID', value: stageInstance.id, inline: true },
                { name: 'Canale', value: `<#${stageInstance.channelId}>`, inline: true },
                { name: 'Privacy Level', value: this.getPrivacyLevel(stageInstance.privacyLevel), inline: true }
            ]
        });
    }

    async handleStageInstanceUpdate(oldStage, newStage) {
        const eventLogger = this.loggerFactory.getLogger('stageInstanceUpdate');
        if (!eventLogger) return;

        const changes = eventLogger.getDifferences(oldStage, newStage, [
            { key: 'topic', name: 'Argomento' },
            { key: 'privacyLevel', name: 'Privacy Level' }
        ]);

        if (changes.length === 0) return;

        await eventLogger.log(newStage.guild.id, {
            title: 'Stage Aggiornato',
            description: `Lo stage è stato modificato`,
            fields: [
                { name: 'Canale', value: `<#${newStage.channelId}>`, inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                ...changes
            ]
        });
    }

    async handleStageInstanceDelete(stageInstance) {
        const eventLogger = this.loggerFactory.getLogger('stageInstanceDelete');
        if (!eventLogger) return;

        await eventLogger.log(stageInstance.guild.id, {
            title: 'Stage Terminato',
            description: `Lo stage **${stageInstance.topic}** è terminato`,
            fields: [
                { name: 'Argomento', value: stageInstance.topic, inline: true },
                { name: 'Canale', value: `<#${stageInstance.channelId}>`, inline: true }
            ],
            color: '#F04747'
        });
    }

    getPrivacyLevel(level) {
        const levels = {
            2: 'Guild Only'
        };
        return levels[level] || `Sconosciuto (${level})`;
    }
}

class WebhookEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleWebhooksUpdate(channel) {
        const eventLogger = this.loggerFactory.getLogger('webhooksUpdate');
        if (!eventLogger) return;

        await eventLogger.log(channel.guild.id, {
            title: 'Webhook Aggiornati',
            description: `I webhook del canale ${channel} sono stati modificati`,
            fields: [
                { name: 'Canale', value: `${channel.name} (<#${channel.id}>)`, inline: true }
            ]
        });
    }
}

class InteractionEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handleInteractionCreate(interaction) {
        if (!interaction.guild) return;

        const eventLogger = this.loggerFactory.getLogger('interactionCreate');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(interaction.guild.id, interaction.user)) return;

        const fields = [
            { name: 'Utente', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
            { name: 'Tipo', value: this.getInteractionType(interaction.type), inline: true },
            { name: 'Canale', value: interaction.channel ? `<#${interaction.channel.id}>` : 'DM', inline: true }
        ];

        if (interaction.isCommand()) {
            fields.push({ name: 'Comando', value: `/${interaction.commandName}`, inline: true });
            
            if (interaction.options?.data.length > 0) {
                const options = interaction.options.data
                    .map(opt => `${opt.name}: ${opt.value}`)
                    .join('\n');
                fields.push({ name: 'Opzioni', value: eventLogger.truncate(options, 1024), inline: false });
            }
        }

        if (interaction.isButton()) {
            fields.push({ name: 'Button ID', value: interaction.customId, inline: true });
        }

        if (interaction.isStringSelectMenu()) {
            fields.push(
                { name: 'Select Menu ID', value: interaction.customId, inline: true },
                { name: 'Valori Selezionati', value: interaction.values.join(', '), inline: false }
            );
        }

        if (interaction.isModalSubmit()) {
            fields.push({ name: 'Modal ID', value: interaction.customId, inline: true });
        }

        await eventLogger.log(interaction.guild.id, {
            title: 'Interazione Creata',
            description: `${interaction.user.tag} ha creato un'interazione`,
            fields,
            thumbnail: interaction.user.displayAvatarURL({ dynamic: true })
        });
    }

    getInteractionType(type) {
        const types = {
            1: 'Ping',
            2: 'Application Command',
            3: 'Message Component',
            4: 'Application Command Autocomplete',
            5: 'Modal Submit'
        };
        return types[type] || `Sconosciuto (${type})`;
    }
}

class PresenceEventHandler {
    constructor(loggerFactory, configManager) {
        this.loggerFactory = loggerFactory;
        this.configManager = configManager;
    }

    async handlePresenceUpdate(oldPresence, newPresence) {
        if (!newPresence.guild) return;

        const eventLogger = this.loggerFactory.getLogger('presenceUpdate');
        if (!eventLogger) return;

        if (this.configManager.shouldIgnore(newPresence.guild.id, newPresence.member)) return;

        if (oldPresence?.status === newPresence.status) return;

        const statusColors = {
            online: '#43B581',
            idle: '#FAA61A',
            dnd: '#F04747',
            offline: '#747F8D'
        };

        await eventLogger.log(newPresence.guild.id, {
            title: 'Presenza Aggiornata',
            description: `Lo stato di ${newPresence.member.user.tag} è cambiato`,
            fields: [
                { name: 'Utente', value: `${newPresence.member.user.tag} (<@${newPresence.userId}>)`, inline: true },
                { name: 'Prima', value: this.getStatusName(oldPresence?.status), inline: true },
                { name: 'Dopo', value: this.getStatusName(newPresence.status), inline: true }
            ],
            thumbnail: newPresence.member.user.displayAvatarURL({ dynamic: true }),
            color: statusColors[newPresence.status] || '#747F8D'
        });
    }

    getStatusName(status) {
        const statuses = {
            online: '🟢 Online',
            idle: '🟡 Assente',
            dnd: '🔴 Non disturbare',
            offline: '⚫ Offline'
        };
        return statuses[status] || 'Sconosciuto';
    }
}

module.exports = {
    AutoModEventHandler,
    StageEventHandler,
    WebhookEventHandler,
    InteractionEventHandler,
    PresenceEventHandler
};
