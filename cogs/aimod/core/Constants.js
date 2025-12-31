const SEVERITY_LEVELS = {
    NONE: 'none',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

const ACTION_TYPES = {
    NONE: 'none',
    DELETE: 'delete',
    WARN: 'warn',
    TIMEOUT: 'timeout',
    BAN: 'ban'
};

const ANALYSIS_TYPES = {
    TOXICITY: 'toxicity',
    SPAM: 'spam',
    INTENT: 'intent',
    MODERATION: 'moderation'
};

const MODERATION_CATEGORIES = {
    HATE: 'hate',
    HATE_THREATENING: 'hate/threatening',
    HARASSMENT: 'harassment',
    HARASSMENT_THREATENING: 'harassment/threatening',
    SELF_HARM: 'self-harm',
    SELF_HARM_INTENT: 'self-harm/intent',
    SELF_HARM_INSTRUCTIONS: 'self-harm/instructions',
    SEXUAL: 'sexual',
    SEXUAL_MINORS: 'sexual/minors',
    VIOLENCE: 'violence',
    VIOLENCE_GRAPHIC: 'violence/graphic'
};

const INTENT_CATEGORIES = {
    HARMLESS: 'harmless',
    SPAM: 'spam',
    TROLLING: 'trolling',
    PHISHING: 'phishing',
    SCAM: 'scam',
    MALICIOUS: 'malicious'
};

const ERROR_MESSAGES = {
    API_ERROR: 'Errore chiamata API OpenAI',
    RATE_LIMIT: 'Rate limit raggiunto',
    INVALID_CONFIG: 'Configurazione non valida',
    MISSING_API_KEY: 'API key OpenAI mancante',
    ANALYSIS_FAILED: 'Analisi fallita',
    ACTION_FAILED: 'Azione di moderazione fallita'
};

const DEFAULT_THRESHOLDS = {
    toxicity: {
        low: 0.3,
        medium: 0.5,
        high: 0.7,
        critical: 0.9
    },
    spam: {
        low: 0.4,
        medium: 0.6,
        high: 0.8,
        critical: 0.95
    },
    confidence: {
        minimum: 0.6
    }
};

const COOLDOWN_DEFAULTS = {
    USER: 4000,
    GLOBAL: 1000,
    API: 2000
};

const OPENAI_MODELS = {
    GPT4: 'gpt-4',
    GPT4_TURBO: 'gpt-4-turbo-preview',
    GPT35_TURBO: 'gpt-3.5-turbo',
    MODERATION: 'omni-moderation-latest'
};

const PROMPTS = {
    TOXICITY_ANALYSIS: `Analizza il seguente messaggio e valuta il livello di tossicità, linguaggio offensivo, hate speech e contenuto inappropriato.
Rispondi SOLO con un JSON nel formato: {"toxicity": <0-1>, "confidence": <0-1>, "reason": "<breve spiegazione>"}`,

    SPAM_DETECTION: `Analizza il seguente messaggio e determina se è spam, pubblicità non richiesta, contenuto ripetitivo o flooding.
Rispondi SOLO con un JSON nel formato: {"spam": <0-1>, "confidence": <0-1>, "reason": "<breve spiegazione>"}`,

    INTENT_CLASSIFICATION: `Classifica l'intento del seguente messaggio. Categorie possibili: harmless, spam, trolling, phishing, scam, malicious.
Rispondi SOLO con un JSON nel formato: {"intent": "<categoria>", "confidence": <0-1>, "reason": "<breve spiegazione>"}`
};

module.exports = {
    SEVERITY_LEVELS,
    ACTION_TYPES,
    ANALYSIS_TYPES,
    MODERATION_CATEGORIES,
    INTENT_CATEGORIES,
    ERROR_MESSAGES,
    DEFAULT_THRESHOLDS,
    COOLDOWN_DEFAULTS,
    OPENAI_MODELS,
    PROMPTS
};
