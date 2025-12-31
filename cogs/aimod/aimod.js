const path = require('path');
const logger = require('../../utils/logger');

const ConfigManager = require('./core/ConfigManager');
const { ACTION_TYPES, DEFAULT_THRESHOLDS } = require('./core/Constants');

const OpenAIService = require('./services/OpenAIService');
const ModerationService = require('./services/ModerationService');
const LogService = require('./services/LogService');

const ToxicityAnalyzer = require('./analyzers/ToxicityAnalyzer');
const SpamAnalyzer = require('./analyzers/SpamAnalyzer');
const IntentAnalyzer = require('./analyzers/IntentAnalyzer');

const DeleteAction = require('./actions/DeleteAction');
const TimeoutAction = require('./actions/TimeoutAction');
const WarnAction = require('./actions/WarnAction');
const BanAction = require('./actions/BanAction');

const ContentAnalysisHandler = require('./handlers/ContentAnalysisHandler');
const BypassHandler = require('./handlers/BypassHandler');
const CooldownHandler = require('./handlers/CooldownHandler');

class AIModCog {
    constructor(client) {
        this.client = client;
        this.name = 'aimod';
        
        this.configPath = path.join(__dirname, 'aimod.json');
        this.configManager = new ConfigManager(this.configPath);

        this.moderationCog = null;

        this.initializeServices();
        this.initializeAnalyzers();
        this.initializeActions();
        this.initializeHandlers();

        this.client.on('messageCreate', (m) => this.onMessage(m));

        logger.info('[AI-MOD] Sistema di moderazione AI enterprise-level inizializzato');
    }

    initializeServices() {
        const openaiConfig = this.configManager.getOpenAIConfig();
        this.openAIService = new OpenAIService(openaiConfig);

        this.logService = new LogService(this.configManager.getLogConfig());

        logger.info('[AI-MOD] Servizi inizializzati');
    }

    initializeAnalyzers() {
        const thresholds = this.configManager.get('thresholds', DEFAULT_THRESHOLDS);

        this.analyzers = {
            toxicity: new ToxicityAnalyzer(
                this.openAIService,
                thresholds.toxicity || DEFAULT_THRESHOLDS.toxicity
            ),
            spam: new SpamAnalyzer(
                this.openAIService,
                thresholds.spam || DEFAULT_THRESHOLDS.spam
            ),
            intent: new IntentAnalyzer(this.openAIService)
        };

        logger.info('[AI-MOD] Analyzers inizializzati');
    }

    initializeActions() {
        const actionConfig = this.configManager.getActionConfig();

        this.actions = {
            [ACTION_TYPES.DELETE]: new DeleteAction(actionConfig),
            [ACTION_TYPES.TIMEOUT]: new TimeoutAction(actionConfig),
            [ACTION_TYPES.WARN]: new WarnAction(actionConfig, this.moderationCog),
            [ACTION_TYPES.BAN]: new BanAction(actionConfig),
            [ACTION_TYPES.NONE]: {
                execute: async () => ({ type: ACTION_TYPES.NONE, success: true })
            }
        };

        this.moderationService = new ModerationService(actionConfig, this.actions);

        logger.info('[AI-MOD] Actions e ModerationService inizializzati');
    }

    initializeHandlers() {
        const moderationConfig = this.configManager.getModerationConfig();
        const bypassConfig = this.configManager.getBypassConfig();
        const cooldownConfig = this.configManager.getCooldownConfig();

        this.contentAnalysisHandler = new ContentAnalysisHandler(
            this.analyzers,
            moderationConfig
        );

        this.bypassHandler = new BypassHandler(bypassConfig);
        this.cooldownHandler = new CooldownHandler(cooldownConfig);

        logger.info('[AI-MOD] Handlers inizializzati');
    }

    bindModerationCog(moderationCog) {
        this.moderationCog = moderationCog;
        if (this.actions[ACTION_TYPES.WARN]) {
            this.actions[ACTION_TYPES.WARN].setModerationCog(moderationCog);
        }
        logger.info('[AI-MOD] Moderation cog collegato');
    }

    async onMessage(message) {
        if (!this.configManager.isEnabled()) {
            return;
        }

        if (!this.bypassHandler.shouldProcess(message)) {
            return;
        }

        if (this.cooldownHandler.isOnCooldown(message.author.id)) {
            return;
        }

        this.cooldownHandler.setCooldown(message.author.id);

        try {
            const analysisResult = await this.contentAnalysisHandler.analyzeMessage(message);

            if (analysisResult.error) {
                logger.error(`[AI-MOD] Errore analisi: ${analysisResult.error}`);
                await this.logService.logError({
                    error: analysisResult.error,
                    context: {
                        userId: message.author.id,
                        channelId: message.channel.id,
                        guildId: message.guild?.id
                    },
                    client: this.client
                });
                return;
            }

            await this.logService.logAnalysis({
                user: message.author,
                channel: message.channel,
                guild: message.guild,
                messageContent: message.content,
                analysisResults: analysisResult.analysisResults,
                timestamp: analysisResult.timestamp,
                client: this.client
            });

            if (!analysisResult.requiresAction) {
                return;
            }

            const moderationResult = await this.moderationService.processViolation(
                message,
                analysisResult.analysisResults
            );

            await this.logService.logModeration({
                user: message.author,
                channel: message.channel,
                guild: message.guild,
                messageContent: message.content,
                analysisResults: analysisResult.analysisResults,
                action: moderationResult.action,
                severity: moderationResult.violation.severity,
                timestamp: new Date(),
                client: this.client
            });

            logger.warn(
                `[AI-MOD] ${message.author.tag} - ` +
                `Azione: ${moderationResult.action.type} - ` +
                `Severità: ${moderationResult.violation.severity} - ` +
                `Score: ${analysisResult.maxScore.toFixed(2)}`
            );

        } catch (error) {
            logger.error(`[AI-MOD] Errore processamento messaggio: ${error.message}`);
            await this.logService.logError({
                error: error.message,
                context: {
                    userId: message.author.id,
                    channelId: message.channel.id,
                    guildId: message.guild?.id,
                    stack: error.stack
                },
                client: this.client
            });
        }
    }

    async analyzeText(text, userId = 'unknown') {
        const mockMessage = {
            content: text,
            author: { id: userId }
        };

        const analysisResult = await this.contentAnalysisHandler.analyzeMessage(mockMessage);
        return analysisResult.analysisResults;
    }

    getStats(userId) {
        return this.moderationService.getStats(userId);
    }

    clearHistory(userId) {
        this.moderationService.clearHistory(userId);
        this.analyzers.spam.clearHistory(userId);
        this.cooldownHandler.clearCooldown(userId);
    }

    reload() {
        this.configManager.reload();
        
        const moderationConfig = this.configManager.getModerationConfig();
        const bypassConfig = this.configManager.getBypassConfig();
        const cooldownConfig = this.configManager.getCooldownConfig();
        const logConfig = this.configManager.getLogConfig();

        this.contentAnalysisHandler.updateConfig(moderationConfig);
        this.bypassHandler.updateConfig(bypassConfig);
        this.cooldownHandler.updateConfig(cooldownConfig);
        this.logService.updateConfig(logConfig);

        logger.info('[AI-MOD] Configurazione ricaricata');
    }

    getStatus() {
        return {
            enabled: this.configManager.isEnabled(),
            openAIInitialized: this.openAIService.isInitialized(),
            moderationCogBound: this.moderationCog !== null,
            analyzers: Object.keys(this.analyzers),
            actions: Object.keys(this.actions),
            handlers: [
                'ContentAnalysisHandler',
                'BypassHandler',
                'CooldownHandler'
            ]
        };
    }
}

function setup(client) {
    const cog = new AIModCog(client);
    logger.info('[AI-MOD] Cog setup completato');
    return cog;
}

module.exports = { setup };
