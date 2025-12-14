const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const logger = require('../../utils/logger');
const { analyzeText } = require('./hfClient');
const { initLogger, logAIMod } = require('./log');

function sanitizeMentions(text) {
    if (!text) return text;
    return text
        .replace(/@everyone/gi, '@\u200beveryone')
        .replace(/@here/gi, '@\u200bhere');
}

class AIModCog {
    constructor(client) {
        this.client = client;
        this.name = 'aimod';

        this.configPath = path.join(__dirname, 'aimod.json');
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        initLogger(this.config.log);

        this.moderationCog = null;
        this.cooldown = new Set();

        this.client.on('messageCreate', (m) => this.onMessage(m));
    }

    bindModerationCog(moderationCog) {
        this.moderationCog = moderationCog;
    }

    isBypassed(message) {
        if (message.author.bot) return true;
        if (!this.config.enabled) return true;

        if (this.config.bypass_admin &&
            message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return true;
        }

        if (this.config.bypass_roles.length > 0 &&
            message.member?.roles.cache.some(r => this.config.bypass_roles.includes(r.id))) {
            return true;
        }

        if (this.config.no_automod_channels.includes(message.channel.id)) {
            return true;
        }

        return false;
    }

    async onMessage(message) {
        if (this.isBypassed(message)) return;
        if (this.cooldown.has(message.author.id)) return;

        this.cooldown.add(message.author.id);
        setTimeout(() => this.cooldown.delete(message.author.id), 4000);

        try {
            const results = await analyzeText(
                message.content,
                this.config.models.toxicity
            );

            const top = results[0];
            if (!top) return;

            const label = top.label.toLowerCase();
            const score = top.score;

            const isBad =
                label.includes('off') ||        // OFF, offensive
                label.includes('toxic') ||      // toxic
                label.includes('hate') ||       // hate
                label.includes('abuse') ||      // abuse
                label.includes('label_1');      // molti modelli = classe "bad"

            if (!isBad) return;

            if (score < this.config.thresholds.warn) return;

            if (this.config.delete_on_violation) {
                await message.delete().catch(() => {});
            }

            const safeContent = sanitizeMentions(message.content);
            const notice = await message.channel.send({
                content:
                    `**Contenuto Rimosso**\n` +
                    `> **Autore:** <@${message.author.id}>\n` +
                    `> **Messaggio:** ${safeContent || '*contenuto vuoto*'}\n` +
                    `> **Toxicity Score:** ${score.toFixed(2)}`
            }).catch(() => null);

            if (notice) {
                setTimeout(() => {
                    notice.delete().catch(() => {});
                }, 3000);
            }

            await logAIMod(this.client, this.config.log, {
                user: message.author,
                channel: message.channel,
                guild: message.guild,
                messageContent: safeContent,
                score: score,
                action: score >= this.config.thresholds.timeout
                    ? 'TIMEOUT'
                    : 'WARN / DELETE'
            });


            if (!this.moderationCog) return;

            if (score >= this.config.thresholds.timeout) {
                await message.member.timeout(
                    this.config.timeout_minutes * 60 * 1000,
                    `AI Moderation (score ${score.toFixed(2)})`
                ).catch(() => {});
            } else {
                this.moderationCog.addWarn?.(
                    message.author.id,
                    `AI Moderation (toxicity ${score.toFixed(2)})`,
                    this.client.user.id
                );
            }

            logger.warn(`[AI-MOD] ${message.author.tag} score=${score.toFixed(2)}`);

        } catch (err) {
            logger.error(`[AI-MOD] HF error: ${err.message}`);
        }
    }
}

function setup(client) {
    const cog = new AIModCog(client);
    return cog;
}

module.exports = { setup };
