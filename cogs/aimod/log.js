const { EmbedBuilder, WebhookClient } = require('discord.js');
const fs = require('fs');
const path = require('path');

let webhookClient = null;

function initLogger(config) {
    if (config.use_webhook && config.webhook_url) {
        webhookClient = new WebhookClient({ url: config.webhook_url });
    }
}

async function logAIMod(client, config, data) {
    if (!config?.enabled) return;

    const {
        user,
        channel,
        guild,
        messageContent,
        score,
        action
    } = data;

    const embed = new EmbedBuilder()
        .setTitle('🧠 AI Moderation')
        .setColor(score >= 0.85 ? 0xff0000 : 0xffa500)
        .addFields(
            {
                name: 'Utente',
                value: `${user.tag} (${user.id})`,
                inline: false
            },
            {
                name: 'Canale',
                value: `<#${channel.id}> (${channel.id})`,
                inline: false
            },
            {
                name: 'Azione',
                value: action,
                inline: true
            },
            {
                name: 'Toxicity score',
                value: score.toFixed(2),
                inline: true
            },
            {
                name: 'Messaggio',
                value: messageContent.length > 900
                    ? messageContent.slice(0, 900) + '…'
                    : messageContent || '*vuoto*',
                inline: false
            }
        )
        .setFooter({
            text: `Server: ${guild.name} (${guild.id})`
        })
        .setTimestamp();

    // ▶ WEBHOOK
    if (config.use_webhook && webhookClient) {
        await webhookClient.send({
            embeds: [embed]
        }).catch(() => {});
        return;
    }

    // ▶ CANALE
    if (config.channel_id) {
        const logChannel = client.channels.cache.get(config.channel_id);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }
}

module.exports = {
    initLogger,
    logAIMod
};
