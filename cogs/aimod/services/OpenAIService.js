const OpenAI = require('openai');
const { OPENAI_MODELS, ERROR_MESSAGES } = require('../core/Constants');

class OpenAIService {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.initialize();
    }

    initialize() {
        const apiKey = this.config.apiKey;

        if (!apiKey) {
            throw new Error(ERROR_MESSAGES.MISSING_API_KEY);
        }

        try {
            this.client = new OpenAI({
                apiKey: apiKey
            });
        } catch (error) {
            throw new Error(`${ERROR_MESSAGES.INVALID_CONFIG}: ${error.message}`);
        }
    }

    async createCompletion(prompt, userMessage, options = {}) {
        if (!this.client) {
            throw new Error('OpenAI client non inizializzato');
        }

        try {
            const response = await this.client.chat.completions.create({
                model: options.model || this.config.model || OPENAI_MODELS.GPT4,
                messages: [
                    {
                        role: 'system',
                        content: prompt
                    },
                    {
                        role: 'user',
                        content: userMessage
                    }
                ],
                max_tokens: options.maxTokens || this.config.maxTokens || 150,
                temperature: options.temperature || this.config.temperature || 0.3,
                response_format: options.jsonMode ? { type: 'json_object' } : undefined
            });

            return response.choices[0].message.content;
        } catch (error) {
            if (error.status === 429) {
                throw new Error(ERROR_MESSAGES.RATE_LIMIT);
            }
            throw new Error(`${ERROR_MESSAGES.API_ERROR}: ${error.message}`);
        }
    }

    async moderateContent(text) {
        if (!this.client) {
            throw new Error('OpenAI client non inizializzato');
        }

        try {
            const response = await this.client.moderations.create({
                model: OPENAI_MODELS.MODERATION,
                input: text
            });

            return response.results[0];
        } catch (error) {
            if (error.status === 429) {
                throw new Error(ERROR_MESSAGES.RATE_LIMIT);
            }
            throw new Error(`${ERROR_MESSAGES.API_ERROR}: ${error.message}`);
        }
    }

    async analyzeWithRetry(analysisFunc, maxRetries = 3, delay = 1000) {
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                return await analysisFunc();
            } catch (error) {
                lastError = error;

                if (error.message.includes(ERROR_MESSAGES.RATE_LIMIT)) {
                    await this.sleep(delay * (i + 1));
                    continue;
                }

                throw error;
            }
        }

        throw lastError;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isInitialized() {
        return this.client !== null;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.initialize();
    }
}

module.exports = OpenAIService;
