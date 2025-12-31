class Formatters {
    static sanitizeMentions(text) {
        if (!text) return text;
        return text
            .replace(/@everyone/gi, '@\u200beveryone')
            .replace(/@here/gi, '@\u200bhere')
            .replace(/<@!?(\d+)>/g, '@user');
    }

    static truncateText(text, maxLength = 900) {
        if (!text) return '*vuoto*';
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    }

    static formatTimestamp(date = new Date()) {
        return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
    }

    static formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}g ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    static formatScore(score) {
        return (score * 100).toFixed(1) + '%';
    }

    static formatModerationResult(result) {
        const parts = [];

        if (result.flagged) {
            parts.push(`**Flagged:** Sì`);
        }

        if (result.categories) {
            const activeCategories = Object.entries(result.categories)
                .filter(([_, value]) => value)
                .map(([key, _]) => key);

            if (activeCategories.length > 0) {
                parts.push(`**Categorie:** ${activeCategories.join(', ')}`);
            }
        }

        if (result.category_scores) {
            const topScores = Object.entries(result.category_scores)
                .sort(([_, a], [__, b]) => b - a)
                .slice(0, 3)
                .map(([key, value]) => `${key}: ${this.formatScore(value)}`);

            parts.push(`**Score:** ${topScores.join(', ')}`);
        }

        return parts.join('\n');
    }

    static formatAnalysisResult(analysis) {
        const parts = [];

        if (analysis.toxicity !== undefined) {
            parts.push(`**Toxicity:** ${this.formatScore(analysis.toxicity)}`);
        }

        if (analysis.spam !== undefined) {
            parts.push(`**Spam:** ${this.formatScore(analysis.spam)}`);
        }

        if (analysis.intent) {
            parts.push(`**Intent:** ${analysis.intent}`);
        }

        if (analysis.confidence !== undefined) {
            parts.push(`**Confidence:** ${this.formatScore(analysis.confidence)}`);
        }

        return parts.join('\n');
    }

    static formatUserInfo(user) {
        return `${user.tag} (${user.id})`;
    }

    static formatChannelInfo(channel) {
        return `<#${channel.id}> (${channel.id})`;
    }

    static formatGuildInfo(guild) {
        return `${guild.name} (${guild.id})`;
    }

    static formatAction(action) {
        const actionMap = {
            delete: '🗑️ Messaggio Eliminato',
            timeout: '⏰ Timeout Applicato',
            warn: '⚠️ Warning Applicato',
            ban: '🔨 Ban Applicato',
            none: 'ℹ️ Nessuna Azione'
        };

        return actionMap[action] || action;
    }

    static getSeverityColor(score) {
        if (score >= 0.9) return 0xFF0000; // Rosso
        if (score >= 0.75) return 0xFF4500; // Arancione scuro
        if (score >= 0.6) return 0xFFA500; // Arancione
        if (score >= 0.4) return 0xFFFF00; // Giallo
        return 0x00FF00; // Verde
    }

    static getActionColor(action) {
        const colorMap = {
            delete: 0xFFA500,
            timeout: 0xFF4500,
            warn: 0xFFFF00,
            ban: 0xFF0000,
            none: 0x808080
        };

        return colorMap[action] || 0x808080;
    }
}

module.exports = Formatters;
