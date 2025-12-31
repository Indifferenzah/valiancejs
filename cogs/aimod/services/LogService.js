const { EmbedBuilder, WebhookClient } = require('discord.js');
const Formatters = require('../core/Formatters');

class LogService {
    constructor(config) {
        this.config = config;
        this.webhookClient = null;
        this.initialize();
    }

    initialize() {
        if (this.config.useWebhook && this.config.webhookUrl) {
            try {
                this.webhookClient = new WebhookClient({ url: this.config.webhookUrl });
            } catch (error) {
                console.error('Errore inizializzazione webhook logger:', error);
            }
        }
    }

    async logModeration(data) {
        if (!this.config.enabled) return;

        const embed = this.createModerationEmbed(data);

        if (this.config.useWebhook && this.webhookClient) {
            await this.sendViaWebhook(embed);
        } else if (this.config.channelId && data.client) {
            await this.sendViaChannel(embed, data.client, this.config.channelId);
        }
    }

    async logAnalysis(data) {
        if (!this.config.enabled) return;

        const embed = this.createAnalysisEmbed(data);

        if (this.config.useWebhook && this.webhookClient) {
            await this.sendViaWebhook(embed);
        } else if (this.config.channelId && data.client) {
            await this.sendViaChannel(embed, data.client, this.config.channelId);
        }
    }

    async logError(data) {
        if (!this.config.enabled) return;

        const embed = this.createErrorEmbed(data);

        if (this.config.useWebhook && this.webhookClient) {
            await this.sendViaWebhook(embed);
        } else if (this.config.channelId && data.client) {
            await this.sendViaChannel(embed, data.client, this.config.channelId);
        }
    }

    createModerationEmbed(data) {
        const {
            user,
            channel,
            guild,
            messageContent,
            analysisResults,
            action,
            severity,
            timestamp
        } = data;

        const maxScore = this.getMaxScore(analysisResults);
        const color = Formatters.getSeverityColor(maxScore);

        const embed = new EmbedBuilder()
            .setTitle('🛡️ AI Moderation - Azione Eseguita')
            .setColor(color)
            .addFields(
                {
                    name: '👤 Utente',
                    value: Formatters.formatUserInfo(user),
                    inline: true
                },
                {
                    name: '📝 Canale',
                    value: Formatters.formatChannelInfo(channel),
                    inline: true
                },
                {
                    name: '⚠️ Severità',
                    value: severity.toUpperCase(),
                    inline: true
                },
                {
                    name: '🎯 Azione',
                    value: Formatters.formatAction(action.type),
                    inline: true
                },
                {
                    name: '✅ Esito',
                    value: action.success ? 'Successo' : `Fallito: ${action.error}`,
                    inline: true
                },
                {
                    name: '📊 Score Massimo',
                    value: Formatters.formatScore(maxScore),
                    inline: true
                }
            )
            .setFooter({
                text: `${Formatters.formatGuildInfo(guild)} | AI Moderation`
            })
            .setTimestamp(timestamp || new Date());

        if (analysisResults.toxicity !== undefined) {
            embed.addFields({
                name: '☠️ Toxicity',
                value: Formatters.formatScore(analysisResults.toxicity),
                inline: true
            });
        }

        if (analysisResults.spam !== undefined) {
            embed.addFields({
                name: '📧 Spam',
                value: Formatters.formatScore(analysisResults.spam),
                inline: true
            });
        }

        if (analysisResults.intent) {
            embed.addFields({
                name: '🎭 Intent',
                value: analysisResults.intent,
                inline: true
            });
        }

        if (this.config.includeContent && messageContent) {
            const safeContent = Formatters.sanitizeMentions(messageContent);
            const truncated = Formatters.truncateText(safeContent, 1000);
            embed.addFields({
                name: '💬 Contenuto',
                value: `\`\`\`${truncated}\`\`\``,
                inline: false
            });
        }

        return embed;
    }

    createAnalysisEmbed(data) {
        const {
            user,
            channel,
            guild,
            messageContent,
            analysisResults,
            timestamp
        } = data;

        const maxScore = this.getMaxScore(analysisResults);
        const color = Formatters.getSeverityColor(maxScore);

        const embed = new EmbedBuilder()
            .setTitle('🔍 AI Analysis - Risultato')
            .setColor(color)
            .addFields(
                {
                    name: '👤 Utente',
                    value: Formatters.formatUserInfo(user),
                    inline: true
                },
                {
                    name: '📝 Canale',
                    value: Formatters.formatChannelInfo(channel),
                    inline: true
                },
                {
                    name: '📊 Score Massimo',
                    value: Formatters.formatScore(maxScore),
                    inline: true
                }
            )
            .setFooter({
                text: `${Formatters.formatGuildInfo(guild)} | AI Analysis`
            })
            .setTimestamp(timestamp || new Date());

        if (analysisResults.toxicity !== undefined) {
            embed.addFields({
                name: '☠️ Toxicity',
                value: Formatters.formatScore(analysisResults.toxicity),
                inline: true
            });
        }

        if (analysisResults.spam !== undefined) {
            embed.addFields({
                name: '📧 Spam',
                value: Formatters.formatScore(analysisResults.spam),
                inline: true
            });
        }

        if (analysisResults.confidence !== undefined) {
            embed.addFields({
                name: '🎯 Confidence',
                value: Formatters.formatScore(analysisResults.confidence),
                inline: true
            });
        }

        if (this.config.includeContent && messageContent) {
            const safeContent = Formatters.sanitizeMentions(messageContent);
            const truncated = Formatters.truncateText(safeContent, 1000);
            embed.addFields({
                name: '💬 Contenuto',
                value: `\`\`\`${truncated}\`\`\``,
                inline: false
            });
        }

        return embed;
    }

    createErrorEmbed(data) {
        const { error, context, timestamp } = data;

        const embed = new EmbedBuilder()
            .setTitle('❌ AI Moderation - Errore')
            .setColor(0xFF0000)
            .addFields(
                {
                    name: '⚠️ Errore',
                    value: `\`\`\`${error}\`\`\``,
                    inline: false
                }
            )
            .setFooter({
                text: 'AI Moderation Error'
            })
            .setTimestamp(timestamp || new Date());

        if (context) {
            embed.addFields({
                name: '📋 Contesto',
                value: `\`\`\`json\n${JSON.stringify(context, null, 2).slice(0, 1000)}\`\`\``,
                inline: false
            });
        }

        return embed;
    }

    getMaxScore(analysisResults) {
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

    async sendViaWebhook(embed) {
        if (!this.webhookClient) return;

        try {
            await this.webhookClient.send({ embeds: [embed] });
        } catch (error) {
            console.error('Errore invio log via webhook:', error);
        }
    }

    async sendViaChannel(embed, client, channelId) {
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel?.isTextBased()) {
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Errore invio log via canale:', error);
        }
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.initialize();
    }
}

module.exports = LogService;
