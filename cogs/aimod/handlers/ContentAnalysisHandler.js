class ContentAnalysisHandler {
    constructor(analyzers, config) {
        this.toxicityAnalyzer = analyzers.toxicity;
        this.spamAnalyzer = analyzers.spam;
        this.intentAnalyzer = analyzers.intent;
        this.config = config;
    }

    async analyzeMessage(message) {
        const text = message.content;
        const userId = message.author.id;

        const results = {
            message: message,
            timestamp: new Date(),
            analysisResults: {}
        };

        try {
            if (this.config.useOpenAIModeration && this.toxicityAnalyzer) {
                const moderationResult = await this.toxicityAnalyzer.analyzeWithOpenAIModeration(text);
                results.analysisResults.moderation = moderationResult.moderation;
                results.analysisResults.toxicity = moderationResult.toxicity;
                results.analysisResults.confidence = moderationResult.confidence;
            }

            if (this.config.useCustomAnalysis) {
                if (this.config.checkToxicity && this.toxicityAnalyzer && !results.analysisResults.toxicity) {
                    const toxicityResult = await this.toxicityAnalyzer.analyze(text);
                    results.analysisResults.toxicity = toxicityResult.toxicity;
                    results.analysisResults.toxicityReason = toxicityResult.reason;
                    results.analysisResults.confidence = Math.max(
                        results.analysisResults.confidence || 0,
                        toxicityResult.confidence
                    );
                }

                if (this.config.checkSpam && this.spamAnalyzer) {
                    const spamResult = await this.spamAnalyzer.analyze(text, userId);
                    results.analysisResults.spam = spamResult.spam;
                    results.analysisResults.spamReason = spamResult.reason;
                    results.analysisResults.spamPatterns = spamResult.patterns;
                }

                if (this.config.checkIntent && this.intentAnalyzer) {
                    const intentResult = await this.intentAnalyzer.analyze(text);
                    results.analysisResults.intent = intentResult.intent;
                    results.analysisResults.intentReason = intentResult.reason;
                    results.analysisResults.intentConfidence = intentResult.confidence;
                }
            }

            results.requiresAction = this.determineIfActionRequired(results.analysisResults);
            results.maxScore = this.calculateMaxScore(results.analysisResults);

            return results;

        } catch (error) {
            results.error = error.message;
            results.requiresAction = false;
            return results;
        }
    }

    determineIfActionRequired(analysisResults) {
        if (analysisResults.toxicity !== undefined && analysisResults.toxicity >= 0.5) {
            return true;
        }

        if (analysisResults.spam !== undefined && analysisResults.spam >= 0.6) {
            return true;
        }

        if (analysisResults.moderation?.flagged) {
            return true;
        }

        if (analysisResults.intent && ['phishing', 'scam', 'malicious'].includes(analysisResults.intent)) {
            return true;
        }

        return false;
    }

    calculateMaxScore(analysisResults) {
        let maxScore = 0;

        if (analysisResults.toxicity !== undefined) {
            maxScore = Math.max(maxScore, analysisResults.toxicity);
        }

        if (analysisResults.spam !== undefined) {
            maxScore = Math.max(maxScore, analysisResults.spam);
        }

        if (analysisResults.moderation?.category_scores) {
            const scores = Object.values(analysisResults.moderation.category_scores);
            maxScore = Math.max(maxScore, ...scores);
        }

        return maxScore;
    }

    async batchAnalyze(messages) {
        const results = [];

        for (const message of messages) {
            try {
                const result = await this.analyzeMessage(message);
                results.push(result);
            } catch (error) {
                results.push({
                    message: message,
                    error: error.message,
                    requiresAction: false,
                    timestamp: new Date()
                });
            }
        }

        return results;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

module.exports = ContentAnalysisHandler;
