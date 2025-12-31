const { EmbedBuilder } = require('discord.js');
const { EMBED_TEMPLATES, MESSAGES } = require('../constants');

function createModerationEmbed({ action, target, moderator, reason, additionalFields = {} }) {
    const template = EMBED_TEMPLATES[action.toUpperCase()] || {
        title: `Moderation Action: ${action}`,
        color: 0x3498DB,
        icon: '⚙️'
    };

    const embed = new EmbedBuilder()
        .setTitle(template.title)
        .setColor(template.color)
        .setTimestamp()
        .setFooter({
            text: `Azione di ${moderator.tag}`,
            iconURL: moderator.displayAvatarURL({ dynamic: true })
        });

    if (target) {
        embed.setDescription(`**Target:** ${target.tag} (${target.id})`);
        embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
    }

    const finalReason = reason || MESSAGES.INFO.NO_REASON;
    embed.addFields({
        name: '📝 Motivo',
        value: finalReason,
        inline: false
    });

    Object.entries(additionalFields).forEach(([name, value]) => {
        embed.addFields({
            name,
            value: String(value),
            inline: true
        });
    });

    return embed;
}

function createWarnListEmbed({ user, warns, totalWarns }) {
    const template = EMBED_TEMPLATES.WARN_LIST;

    const embed = new EmbedBuilder()
        .setTitle(`${template.icon} Storico Warning — ${user.tag}`)
        .setDescription(`**Warning Totali:** ${totalWarns}`)
        .setColor(template.color)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    if (warns.length === 0) {
        embed.setDescription('**Warning Totali:** 0\n\n✅ Questo utente ha una fedina pulita.');
        return embed;
    }

    warns.forEach((warn, index) => {
        const date = warn.timestamp 
            ? new Date(warn.timestamp).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'Unknown date';

        const moderatorMention = warn.moderator ? `<@${warn.moderator}>` : 'Sconosciuto';

        embed.addFields({
            name: `⚠️ Warning #${index + 1}`,
            value: [
                `**Motivo:** ${warn.reason || 'Nessun motivo fornito'}`,
                `**Moderatore:** ${moderatorMention}`,
                `**Data:** ${date}`
            ].join('\n'),
            inline: false
        });
    });

    embed.setFooter({
        text: `Usa /warn remove per rimuovere un warning specifico`
    });

    return embed;
}

function createErrorEmbed(message, options = {}) {
    const embed = new EmbedBuilder()
        .setTitle('❌ Errore')
        .setDescription(message)
        .setColor(0xFF0000)
        .setTimestamp();

    if (options.details) {
        embed.addFields({
            name: '📋 Dettagli',
            value: options.details,
            inline: false
        });
    }

    return embed;
}

function createSuccessEmbed(message, options = {}) {
    const embed = new EmbedBuilder()
        .setTitle('✅ Successo')
        .setDescription(message)
        .setColor(0x00FF00)
        .setTimestamp();

    if (options.fields) {
        Object.entries(options.fields).forEach(([name, value]) => {
            embed.addFields({
                name,
                value: String(value),
                inline: true
            });
        });
    }

    return embed;
}

function createInfoEmbed(title, message) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(message)
        .setColor(0x3498DB)
        .setTimestamp();
}

module.exports = {
    createModerationEmbed,
    createWarnListEmbed,
    createErrorEmbed,
    createSuccessEmbed,
    createInfoEmbed
};
