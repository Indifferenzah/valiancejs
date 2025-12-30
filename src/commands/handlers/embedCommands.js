const { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const logger = require('../../../utils/logger');
const { ownerOrHasPermissions } = require('../../../utils/botUtils');

/**
 * Classe per gestire la sessione di creazione embed
 */
class EmbedCreatorSession {
    constructor(authorId, interaction) {
        this.authorId = authorId;
        this.interaction = interaction;
        this.embed = new EmbedBuilder()
            .setTitle('Embed Creator')
            .setDescription("Usa il menu per personalizzare l'embed. Usa `//` per rimuovere un campo.")
            .setColor(0x00ff00)
            .setFooter({ text: 'Valiance Bot - Embed Creator' });
        this.fields = [];
        this.messageContent = '';
        this.targetChannel = null;
    }

    buildEmbed() {
        const clone = EmbedBuilder.from(this.embed);
        clone.data.fields = [];
        for (const f of this.fields) {
            clone.addFields(f);
        }
        return clone;
    }

    components() {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('embed_creator_select')
            .setPlaceholder('Seleziona cosa modificare')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Titolo').setValue('title').setDescription('Modifica il titolo'),
                new StringSelectMenuOptionBuilder().setLabel('Descrizione').setValue('description').setDescription('Modifica la descrizione'),
                new StringSelectMenuOptionBuilder().setLabel('Colore').setValue('color').setDescription('Modifica il colore'),
                new StringSelectMenuOptionBuilder().setLabel('Thumbnail').setValue('thumbnail').setDescription('Modifica il thumbnail'),
                new StringSelectMenuOptionBuilder().setLabel('Immagine').setValue('image').setDescription("Modifica l'immagine principale"),
                new StringSelectMenuOptionBuilder().setLabel('Footer').setValue('footer').setDescription('Modifica il footer'),
                new StringSelectMenuOptionBuilder().setLabel('Aggiungi Campo').setValue('add_field').setDescription('Aggiungi un campo'),
                new StringSelectMenuOptionBuilder().setLabel('Messaggio Fuori Embed').setValue('content').setDescription("Testo insieme all'embed"),
                new StringSelectMenuOptionBuilder().setLabel('Scegli Canale').setValue('choose_channel').setDescription('Canale dove inviare'),
                new StringSelectMenuOptionBuilder().setLabel('Invia Embed').setValue('send').setDescription("Invia l'embed"),
                new StringSelectMenuOptionBuilder().setLabel('Annulla').setValue('cancel').setDescription('Annulla creazione')
            );
        return [new ActionRowBuilder().addComponents(menu)];
    }

    async showFieldModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('embed_field_modal')
            .setTitle('Aggiungi Campo')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('field_name')
                        .setLabel('Nome del campo')
                        .setRequired(true)
                        .setMaxLength(256)
                        .setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('field_value')
                        .setLabel('Valore del campo')
                        .setRequired(true)
                        .setMaxLength(1024)
                        .setStyle(TextInputStyle.Paragraph)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('field_inline')
                        .setLabel('Inline? (true/false, opzionale)')
                        .setRequired(false)
                        .setMaxLength(5)
                        .setStyle(TextInputStyle.Short)
                )
            );
        await interaction.showModal(modal);
        const submitted = await interaction.awaitModalSubmit({
            filter: (m) => m.customId === 'embed_field_modal' && m.user.id === this.authorId,
            time: 300000
        }).catch(() => null);
        if (!submitted) return;
        const name = submitted.fields.getTextInputValue('field_name').trim();
        const value = submitted.fields.getTextInputValue('field_value').trim();
        const inlineRaw = submitted.fields.getTextInputValue('field_inline').trim().toLowerCase();
        const inline = inlineRaw === 'true';
        if (name === '//' || value === '//') {
            await submitted.update({ components: this.components(), embeds: [this.buildEmbed()] });
            return;
        }
        if (this.fields.length >= 25) {
            await submitted.reply({ content: '⚠️ Puoi aggiungere massimo 25 campi!', ephemeral: true });
            return;
        }
        this.fields.push({ name, value, inline });
        await submitted.update({ embeds: [this.buildEmbed()], components: this.components() });
    }

    async showChannelModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('embed_channel_modal')
            .setTitle('Scegli Canale')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('channel_id')
                        .setLabel('ID del canale')
                        .setRequired(true)
                        .setMaxLength(25)
                        .setStyle(TextInputStyle.Short)
                )
            );
        await interaction.showModal(modal);
        const submitted = await interaction.awaitModalSubmit({
            filter: (m) => m.customId === 'embed_channel_modal' && m.user.id === this.authorId,
            time: 300000
        }).catch(() => null);
        if (!submitted) return;
        const channelId = submitted.fields.getTextInputValue('channel_id').trim();
        const channel = submitted.guild.channels.cache.get(channelId);
        if (!channel) {
            await submitted.reply({ content: '❌ Canale non trovato!', ephemeral: true });
            return;
        }
        this.targetChannel = channel;
        await submitted.reply({ content: `✅ Canale impostato a ${channel}.`, ephemeral: true });
    }

    async showEditModal(interaction, field) {
        const modalId = `embed_edit_${field}`;
        const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(`Modifica ${field}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('value')
                        .setLabel(`Nuovo ${field}`)
                        .setRequired(true)
                        .setMaxLength(4000)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Usa // per cancellare')
                )
            );
        await interaction.showModal(modal);
        const submitted = await interaction.awaitModalSubmit({
            filter: (m) => m.customId === modalId && m.user.id === this.authorId,
            time: 300000
        }).catch(() => null);
        if (!submitted) return;
        const value = submitted.fields.getTextInputValue('value').trim();
        try {
            if (value === '//') {
                switch (field) {
                    case 'color':
                        this.embed.setColor(null);
                        break;
                    case 'thumbnail':
                        this.embed.setThumbnail(null);
                        break;
                    case 'image':
                        this.embed.setImage(null);
                        break;
                    case 'footer':
                        this.embed.setFooter(null);
                        break;
                    case 'content':
                        this.messageContent = '';
                        break;
                    case 'title':
                        this.embed.setTitle('');
                        break;
                    case 'description':
                        this.embed.setDescription('');
                        break;
                    default:
                        break;
                }
            } else {
                switch (field) {
                    case 'color': {
                        let parsed = value;
                        if (value.startsWith('#')) parsed = parseInt(value.slice(1), 16);
                        else parsed = parseInt(value, 10);
                        if (Number.isNaN(parsed)) throw new Error('Colore non valido');
                        this.embed.setColor(parsed);
                        break;
                    }
                    case 'thumbnail':
                        this.embed.setThumbnail(value);
                        break;
                    case 'image':
                        this.embed.setImage(value);
                        break;
                    case 'footer':
                        this.embed.setFooter({ text: value, iconURL: this.embed.data.footer?.icon_url });
                        break;
                    case 'content':
                        this.messageContent = value;
                        break;
                    case 'title':
                        this.embed.setTitle(value);
                        break;
                    case 'description':
                        this.embed.setDescription(value);
                        break;
                    default:
                        break;
                }
            }
            await submitted.update({ embeds: [this.buildEmbed()], components: this.components() });
        } catch (error) {
            await submitted.reply({ content: `❌ Errore nella modifica: ${error.message}`, ephemeral: true });
        }
    }

    async sendEmbed(interaction) {
        try {
            const targetChannel = this.targetChannel || interaction.channel;
            await targetChannel.send({ content: this.messageContent || null, embeds: [this.buildEmbed()] });
            await interaction.update({ content: '✅ Embed inviato con successo!', embeds: [], components: [] });
            logger.info(`Embed inviato da ${interaction.user.tag} in ${interaction.guild.name}`);
        } catch (error) {
            await interaction.reply({ content: `❌ Errore nell'invio dell'embed: ${error.message}`, ephemeral: true });
        }
    }
}

/**
 * Gestisce il comando /embed
 */
async function handleEmbed(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
        await interaction.reply({ content: '❌ Non hai abbastanza permessi!', ephemeral: true });
        return;
    }

    const session = new EmbedCreatorSession(interaction.user.id, interaction);
    const reply = await interaction.reply({
        embeds: [session.buildEmbed()],
        components: session.components(),
        ephemeral: true,
        fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
        time: 300000,
        filter: (i) => i.user.id === interaction.user.id && i.customId === 'embed_creator_select'
    });

    collector.on('collect', async (i) => {
        const choice = i.values[0];
        switch (choice) {
            case 'send':
                await session.sendEmbed(i);
                collector.stop('sent');
                break;
            case 'cancel':
                await i.update({ content: '❌ Creazione embed annullata.', embeds: [], components: [] });
                collector.stop('cancel');
                break;
            case 'add_field':
                await session.showFieldModal(i);
                break;
            case 'choose_channel':
                await session.showChannelModal(i);
                break;
            default:
                await session.showEditModal(i, choice);
                break;
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            await interaction.editReply({ content: '⏱️ Tempo scaduto.', components: [], embeds: [] }).catch(() => { });
        }
    });

    logger.info(`/embed used by ${interaction.user.tag} in ${interaction.guild.name}`);
}

module.exports = { handleEmbed, EmbedCreatorSession };
