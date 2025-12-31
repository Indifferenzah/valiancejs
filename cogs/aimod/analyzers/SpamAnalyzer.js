const { PROMPTS, ERROR_MESSAGES } = require('../core/Constants');

class SpamAnalyzer {
    constructor(openAIService, thresholds) {
        this.openAIService = openAIService;
        this.thresholds = thresholds;
        this.messageHistory = new Map();
    }

    async analyze(text, userId) {
        try {
            const aiResult = await this.analyzeWithAI(text);
            const patternResult = this.analyzePatterns(text, userId);

            const combinedScore = Math.max(aiResult.spam, patternResult.score);

            return {
                spam: combinedScore,
                confidence: (aiResult.confidence + patternResult.confidence) / 2,
                reason: this.combineReasons(aiResult.reason, patternResult.reasons),
                patterns: patternResult.patterns,
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`${ERROR_MESSAGES.ANALYSIS_FAILED} (Spam): ${error.message}`);
        }
    }

    async analyzeWithAI(text) {
        const response = await this.openAIService.createCompletion(
            PROMPTS.SPAM_DETECTION,
            text,
            { jsonMode: true }
        );

        const result = JSON.parse(response);

        return {
            spam: result.spam || 0,
            confidence: result.confidence || 0,
            reason: result.reason || 'Nessuna ragione fornita'
        };
    }

    analyzePatterns(text, userId) {
        const patterns = [];
        const reasons = [];
        let score = 0;
        let confidence = 0.7;

        if (this.hasExcessiveRepetition(text)) {
            patterns.push('excessive_repetition');
            reasons.push('Ripetizioni eccessive');
            score = Math.max(score, 0.8);
        }

        if (this.hasExcessiveCapitals(text)) {
            patterns.push('excessive_capitals');
            reasons.push('Uso eccessivo di maiuscole');
            score = Math.max(score, 0.6);
        }

        if (this.hasExcessiveEmojis(text)) {
            patterns.push('excessive_emojis');
            reasons.push('Uso eccessivo di emoji');
            score = Math.max(score, 0.5);
        }

        if (this.hasExcessiveLinks(text)) {
            patterns.push('excessive_links');
            reasons.push('Troppi link');
            score = Math.max(score, 0.9);
        }

        if (this.hasCommonSpamPhrases(text)) {
            patterns.push('spam_phrases');
            reasons.push('Frasi spam comuni');
            score = Math.max(score, 0.85);
        }

        const rapidScore = this.checkRapidMessages(userId, text);
        if (rapidScore > 0) {
            patterns.push('rapid_messages');
            reasons.push('Messaggi troppo rapidi');
            score = Math.max(score, rapidScore);
        }

        return {
            score,
            confidence,
            patterns,
            reasons
        };
    }

    hasExcessiveRepetition(text) {
        const words = text.toLowerCase().split(/\s+/);
        const wordCount = new Map();

        for (const word of words) {
            if (word.length < 3) continue;
            wordCount.set(word, (wordCount.get(word) || 0) + 1);
        }

        for (const count of wordCount.values()) {
            if (count > 5) return true;
        }

        const charPattern = /(.)\1{4,}/;
        return charPattern.test(text);
    }

    hasExcessiveCapitals(text) {
        const capitals = (text.match(/[A-Z]/g) || []).length;
        const letters = (text.match(/[a-zA-Z]/g) || []).length;

        if (letters < 10) return false;

        return (capitals / letters) > 0.7;
    }

    hasExcessiveEmojis(text) {
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        const emojis = (text.match(emojiRegex) || []).length;

        return emojis > 10 || (emojis > 5 && text.length < 50);
    }

    hasExcessiveLinks(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = (text.match(urlRegex) || []).length;

        return links > 3;
    }

    hasCommonSpamPhrases(text) {
        const lowerText = text.toLowerCase();
        const spamPhrases = [
            'click here',
            'clicca qui',
            'free money',
            'soldi gratis',
            'guadagna subito',
            'make money fast',
            'buy now',
            'compra ora',
            'limited offer',
            'offerta limitata',
            'act now',
            'agisci ora',
            'join my server',
            'entra nel mio server',
            'nitro gratis',
            'free nitro'
        ];

        return spamPhrases.some(phrase => lowerText.includes(phrase));
    }

    checkRapidMessages(userId, currentMessage) {
        if (!this.messageHistory.has(userId)) {
            this.messageHistory.set(userId, []);
        }

        const history = this.messageHistory.get(userId);
        const now = Date.now();

        history.push({ text: currentMessage, timestamp: now });

        const recent = history.filter(msg => now - msg.timestamp < 10000);
        this.messageHistory.set(userId, recent.slice(-20));

        if (recent.length >= 5) {
            const uniqueMessages = new Set(recent.map(m => m.text));
            if (uniqueMessages.size < recent.length * 0.3) {
                return 0.95;
            }

            if (recent.length >= 8) {
                return 0.8;
            }

            return 0.6;
        }

        return 0;
    }

    combineReasons(aiReason, patternReasons) {
        const combined = [aiReason, ...patternReasons].filter(r => r && r.length > 0);
        return combined.join('; ');
    }

    isViolation(spamScore) {
        return spamScore >= this.thresholds.medium;
    }

    getSeverity(spamScore) {
        if (spamScore >= this.thresholds.critical) return 'critical';
        if (spamScore >= this.thresholds.high) return 'high';
        if (spamScore >= this.thresholds.medium) return 'medium';
        if (spamScore >= this.thresholds.low) return 'low';
        return 'none';
    }

    clearHistory(userId) {
        this.messageHistory.delete(userId);
    }
}

module.exports = SpamAnalyzer;
