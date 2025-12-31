const { PROMPTS, ERROR_MESSAGES } = require('../core/Constants');

class ToxicityAnalyzer {
    constructor(openAIService, thresholds) {
        this.openAIService = openAIService;
        this.thresholds = thresholds;
    }

    async analyze(text) {
        try {
            const response = await this.openAIService.createCompletion(
                PROMPTS.TOXICITY_ANALYSIS,
                text,
                { jsonMode: true }
            );

            const result = JSON.parse(response);

            return {
                toxicity: result.toxicity || 0,
                confidence: result.confidence || 0,
                reason: result.reason || 'Nessuna ragione fornita',
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`${ERROR_MESSAGES.ANALYSIS_FAILED} (Toxicity): ${error.message}`);
        }
    }

    async analyzeWithOpenAIModeration(text) {
        try {
            const moderationResult = await this.openAIService.moderateContent(text);

            const toxicityScore = this.calculateToxicityScore(moderationResult);

            return {
                toxicity: toxicityScore,
                confidence: moderationResult.flagged ? 0.95 : 0.5,
                moderation: moderationResult,
                reason: this.generateReasonFromModeration(moderationResult),
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`${ERROR_MESSAGES.ANALYSIS_FAILED} (OpenAI Moderation): ${error.message}`);
        }
    }

    calculateToxicityScore(moderationResult) {
        if (!moderationResult.category_scores) return 0;

        const scores = moderationResult.category_scores;
        const relevantCategories = [
            'hate',
            'hate/threatening',
            'harassment',
            'harassment/threatening',
            'violence',
            'violence/graphic'
        ];

        let maxScore = 0;
        for (const category of relevantCategories) {
            if (scores[category] !== undefined) {
                maxScore = Math.max(maxScore, scores[category]);
            }
        }

        return maxScore;
    }

    generateReasonFromModeration(moderationResult) {
        if (!moderationResult.flagged) {
            return 'Contenuto appropriato';
        }

        const activeCategories = Object.entries(moderationResult.categories || {})
            .filter(([_, value]) => value)
            .map(([key, _]) => this.translateCategory(key));

        if (activeCategories.length === 0) {
            return 'Contenuto inappropriato (categoria non specificata)';
        }

        return `Rilevato: ${activeCategories.join(', ')}`;
    }

    translateCategory(category) {
        const translations = {
            'hate': 'Hate Speech',
            'hate/threatening': 'Hate Speech con Minacce',
            'harassment': 'Molestie',
            'harassment/threatening': 'Molestie con Minacce',
            'self-harm': 'Autolesionismo',
            'self-harm/intent': 'Intento di Autolesionismo',
            'self-harm/instructions': 'Istruzioni per Autolesionismo',
            'sexual': 'Contenuto Sessuale',
            'sexual/minors': 'Contenuto Sessuale Minorile',
            'violence': 'Violenza',
            'violence/graphic': 'Violenza Grafica'
        };

        return translations[category] || category;
    }

    isViolation(toxicityScore) {
        return toxicityScore >= this.thresholds.medium;
    }

    getSeverity(toxicityScore) {
        if (toxicityScore >= this.thresholds.critical) return 'critical';
        if (toxicityScore >= this.thresholds.high) return 'high';
        if (toxicityScore >= this.thresholds.medium) return 'medium';
        if (toxicityScore >= this.thresholds.low) return 'low';
        return 'none';
    }
}

module.exports = ToxicityAnalyzer;
