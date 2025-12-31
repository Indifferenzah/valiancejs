const { PROMPTS, INTENT_CATEGORIES, ERROR_MESSAGES } = require('../core/Constants');

class IntentAnalyzer {
    constructor(openAIService) {
        this.openAIService = openAIService;
    }

    async analyze(text) {
        try {
            const response = await this.openAIService.createCompletion(
                PROMPTS.INTENT_CLASSIFICATION,
                text,
                { jsonMode: true }
            );

            const result = JSON.parse(response);

            return {
                intent: result.intent || INTENT_CATEGORIES.HARMLESS,
                confidence: result.confidence || 0,
                reason: result.reason || 'Nessuna ragione fornita',
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`${ERROR_MESSAGES.ANALYSIS_FAILED} (Intent): ${error.message}`);
        }
    }

    isMalicious(intent) {
        const maliciousIntents = [
            INTENT_CATEGORIES.PHISHING,
            INTENT_CATEGORIES.SCAM,
            INTENT_CATEGORIES.MALICIOUS
        ];

        return maliciousIntents.includes(intent);
    }

    isSuspicious(intent) {
        const suspiciousIntents = [
            INTENT_CATEGORIES.SPAM,
            INTENT_CATEGORIES.TROLLING,
            ...this.getMaliciousIntents()
        ];

        return suspiciousIntents.includes(intent);
    }

    getMaliciousIntents() {
        return [
            INTENT_CATEGORIES.PHISHING,
            INTENT_CATEGORIES.SCAM,
            INTENT_CATEGORIES.MALICIOUS
        ];
    }

    getSeverity(intent, confidence) {
        if (this.isMalicious(intent) && confidence >= 0.7) {
            return 'critical';
        }

        if (this.isMalicious(intent) || (intent === INTENT_CATEGORIES.TROLLING && confidence >= 0.8)) {
            return 'high';
        }

        if (intent === INTENT_CATEGORIES.SPAM && confidence >= 0.6) {
            return 'medium';
        }

        if (this.isSuspicious(intent)) {
            return 'low';
        }

        return 'none';
    }

    getRiskScore(intent, confidence) {
        const intentScores = {
            [INTENT_CATEGORIES.HARMLESS]: 0,
            [INTENT_CATEGORIES.SPAM]: 0.5,
            [INTENT_CATEGORIES.TROLLING]: 0.6,
            [INTENT_CATEGORIES.PHISHING]: 0.9,
            [INTENT_CATEGORIES.SCAM]: 0.9,
            [INTENT_CATEGORIES.MALICIOUS]: 1.0
        };

        const baseScore = intentScores[intent] || 0;
        return baseScore * confidence;
    }

    translateIntent(intent) {
        const translations = {
            [INTENT_CATEGORIES.HARMLESS]: 'Innocuo',
            [INTENT_CATEGORIES.SPAM]: 'Spam',
            [INTENT_CATEGORIES.TROLLING]: 'Trolling',
            [INTENT_CATEGORIES.PHISHING]: 'Phishing',
            [INTENT_CATEGORIES.SCAM]: 'Truffa',
            [INTENT_CATEGORIES.MALICIOUS]: 'Malintenzionato'
        };

        return translations[intent] || intent;
    }
}

module.exports = IntentAnalyzer;
