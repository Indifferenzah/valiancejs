const { ACTION_TYPES, SEVERITY_LEVELS } = require('../core/Constants');

class ModerationService {
    constructor(config, actions) {
        this.config = config;
        this.actions = actions;
        this.violationHistory = new Map();
    }

    async processViolation(message, analysisResults) {
        const severity = this.determineSeverity(analysisResults);
        const actionType = this.determineAction(severity, message.author.id);

        const violationData = {
            userId: message.author.id,
            guildId: message.guild.id,
            channelId: message.channel.id,
            messageId: message.id,
            content: message.content,
            severity: severity,
            analysisResults: analysisResults,
            timestamp: new Date(),
            actionTaken: actionType
        };

        this.recordViolation(message.author.id, violationData);

        const actionResult = await this.executeAction(actionType, message, violationData);

        return {
            violation: violationData,
            action: actionResult
        };
    }

    determineSeverity(analysisResults) {
        let maxScore = 0;

        if (analysisResults.toxicity !== undefined) {
            maxScore = Math.max(maxScore, analysisResults.toxicity);
        }

        if (analysisResults.spam !== undefined) {
            maxScore = Math.max(maxScore, analysisResults.spam);
        }

        if (analysisResults.moderation?.category_scores) {
            const moderationScores = Object.values(analysisResults.moderation.category_scores);
            maxScore = Math.max(maxScore, ...moderationScores);
        }

        if (maxScore >= 0.9) return SEVERITY_LEVELS.CRITICAL;
        if (maxScore >= 0.7) return SEVERITY_LEVELS.HIGH;
        if (maxScore >= 0.5) return SEVERITY_LEVELS.MEDIUM;
        if (maxScore >= 0.3) return SEVERITY_LEVELS.LOW;
        return SEVERITY_LEVELS.NONE;
    }

    determineAction(severity, userId) {
        const history = this.getViolationHistory(userId);
        const recentViolations = this.getRecentViolations(userId, 24 * 60 * 60 * 1000);

        if (severity === SEVERITY_LEVELS.CRITICAL) {
            if (recentViolations >= this.config.banThreshold) {
                return ACTION_TYPES.BAN;
            }
            return ACTION_TYPES.TIMEOUT;
        }

        if (severity === SEVERITY_LEVELS.HIGH) {
            if (recentViolations >= 3) {
                return ACTION_TYPES.TIMEOUT;
            }
            return ACTION_TYPES.WARN;
        }

        if (severity === SEVERITY_LEVELS.MEDIUM) {
            return ACTION_TYPES.WARN;
        }

        if (severity === SEVERITY_LEVELS.LOW && this.config.deleteMessage) {
            return ACTION_TYPES.DELETE;
        }

        return ACTION_TYPES.NONE;
    }

    async executeAction(actionType, message, violationData) {
        const action = this.actions[actionType];

        if (!action) {
            return {
                type: ACTION_TYPES.NONE,
                success: false,
                error: 'Azione non trovata'
            };
        }

        try {
            const result = await action.execute(message, violationData);
            return {
                type: actionType,
                success: true,
                ...result
            };
        } catch (error) {
            return {
                type: actionType,
                success: false,
                error: error.message
            };
        }
    }

    recordViolation(userId, violationData) {
        if (!this.violationHistory.has(userId)) {
            this.violationHistory.set(userId, []);
        }

        const history = this.violationHistory.get(userId);
        history.push(violationData);

        if (history.length > 100) {
            history.shift();
        }
    }

    getViolationHistory(userId) {
        return this.violationHistory.get(userId) || [];
    }

    getRecentViolations(userId, timeWindowMs) {
        const history = this.getViolationHistory(userId);
        const now = Date.now();

        return history.filter(v => now - v.timestamp.getTime() < timeWindowMs).length;
    }

    clearHistory(userId) {
        this.violationHistory.delete(userId);
    }

    getStats(userId) {
        const history = this.getViolationHistory(userId);

        if (history.length === 0) {
            return {
                totalViolations: 0,
                recentViolations: 0,
                severityBreakdown: {},
                lastViolation: null
            };
        }

        const severityBreakdown = {};
        for (const violation of history) {
            severityBreakdown[violation.severity] = (severityBreakdown[violation.severity] || 0) + 1;
        }

        return {
            totalViolations: history.length,
            recentViolations: this.getRecentViolations(userId, 24 * 60 * 60 * 1000),
            severityBreakdown: severityBreakdown,
            lastViolation: history[history.length - 1]
        };
    }
}

module.exports = ModerationService;
