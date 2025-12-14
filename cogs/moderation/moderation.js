const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const logger = require('../../utils/logger');
const path = require('path');

class ModerationCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, 'moderation.json');
        this.warnsPath = path.join(__dirname, 'warns.json');
        this.config = this.loadConfig();
        this.warns = this.loadWarns();
        
        this.commands = [
            new SlashCommandBuilder()
                .setName('ban')
                .setDescription('Banna un membro')
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                .addUserOption(option => option.setName('user').setDescription('Utente da bannare').setRequired(true))
                .addStringOption(option => option.setName('reason').setDescription('Motivo del ban').setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('kick')
                .setDescription('Kicka un membro')
                .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
                .addUserOption(option => option.setName('user').setDescription('Utente da kickare').setRequired(true))
                .addStringOption(option => option.setName('reason').setDescription('Motivo del kick').setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('unban')
                .setDescription('Sbanna un utente tramite ID')
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                .addStringOption(option => option.setName('id').setDescription('ID utente da sbannare').setRequired(true).setAutocomplete(true))
                .addStringOption(option => option.setName('reason').setDescription('Motivo dell unban').setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('mute')
                .setDescription('Muta un membro')
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                .addUserOption(option => option.setName('user').setDescription('Utente da mutare').setRequired(true))
                .addStringOption(option => option.setName('duration').setDescription('Durata (es: 10m, 1h, 1d)').setRequired(false))
                .addStringOption(option => option.setName('reason').setDescription('Motivo del mute').setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('unmute')
                .setDescription('Smuta un membro')
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                .addUserOption(option => option.setName('user').setDescription('Utente da smutare').setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('warn')
                .setDescription('Gestisci i warn')
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                .addSubcommand(subcommand =>
                    subcommand.setName('add')
                        .setDescription('Aggiungi un warn')
                        .addUserOption(option => option.setName('user').setDescription('Utente').setRequired(true))
                        .addStringOption(option => option.setName('reason').setDescription('Motivo').setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand.setName('list')
                        .setDescription('Mostra i warn di un utente')
                        .addUserOption(option => option.setName('user').setDescription('Utente').setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand.setName('remove')
                        .setDescription('Rimuovi un singolo warn tramite ID')
                        .addUserOption(option => option.setName('user').setDescription('Utente').setRequired(true))
                        .addIntegerOption(option => option.setName('id').setDescription('ID del warn (vedi /warn list)').setRequired(true).setMinValue(1)))
                .addSubcommand(subcommand =>
                    subcommand.setName('clear')
                        .setDescription('Rimuovi tutti i warn')
                        .addUserOption(option => option.setName('user').setDescription('Utente').setRequired(true))),
            
            new SlashCommandBuilder()
                .setName('nick')
                .setDescription('Imposta nickname a un utente')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
                .addStringOption(option => option.setName('nick').setDescription('Nuovo nickname').setRequired(true))
                .addUserOption(option => option.setName('user').setDescription('Utente').setRequired(true))
        ];

        this.contextMenus = [
            new ContextMenuCommandBuilder()
                .setName('Ban')
                .setType(ApplicationCommandType.User),

            new ContextMenuCommandBuilder()
                .setName('Kick')
                .setType(ApplicationCommandType.User),

            new ContextMenuCommandBuilder()
                .setName('Timeout')
                .setType(ApplicationCommandType.User),
        ];
    }

    loadConfig() {
        return loadJsonSync(this.configPath, {
            staff_role_id: "1350073958933729371",
            mod_role_id: "1350073957168058408",
            warn_channel_id: "1351184266284896347",
            no_automod: ["1350073967716732971", "1364656451779428462"]
        });
    }

    loadWarns() {
        return loadJsonSync(this.warnsPath, {});
    }

    saveWarns() {
        saveJsonSync(this.warnsPath, this.warns);
    }

    reloadConfig() {
        this.config = this.loadConfig();
    }

    async handleBan(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.BanMembers)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per bannare!', ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'Nessun motivo specificato';

        try {
            await interaction.guild.members.ban(user, { reason });
            
            const embed = new EmbedBuilder()
                .setTitle('🔨 Utente Bannato')
                .setDescription(`**${user.tag}** è stato bannato`)
                .addFields({ name: 'Motivo', value: reason })
                .setColor(0xff0000)
                .setFooter({ text: `Bannato da ${interaction.user.tag}` });

            await interaction.reply({ embeds: [embed] });
            logger.info(`${user.tag} banned by ${interaction.user.tag}: ${reason}`);
        } catch (error) {
            await interaction.reply({ content: `❌ modCog.Errore1: ${error.message}`, ephemeral: true });
        }
    }

    async handleUnban(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.BanMembers)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per sbannare!', ephemeral: true });
            return;
        }

        const userId = interaction.options.getString('id');
        const reason = interaction.options.getString('reason') || 'Nessun motivo specificato';

        try {
            const bans = await interaction.guild.bans.fetch();
            const bannedUser = bans.get(userId);

            if (!bannedUser) {
                await interaction.reply({ content: '❌ Utente non trovato nella lista ban.', ephemeral: true });
                return;
            }

            await interaction.guild.bans.remove(userId, reason);

            const embed = new EmbedBuilder()
                .setTitle('♻️ Utente Sbannato')
                .setDescription(`L'utente con ID **${userId}** è stato sbannato.`)
                .addFields({ name: 'Motivo', value: reason })
                .setColor(0x00ff00)
                .setFooter({ text: `Sbannato da ${interaction.user.tag}` });

            await interaction.reply({ embeds: [embed] });
            logger.info(`User ${userId} unbanned by ${interaction.user.tag}: ${reason}`);

        } catch (error) {
            await interaction.reply({ content: `❌ modCog.Errore2: ${error.message}`, ephemeral: true });
            logger.error(`Unban failed for ${userId} by ${interaction.user.tag}: ${error.message}`);
        }
    }

    async handleUnbanAutocomplete(interaction) {
        const focused = interaction.options.getFocused();
        try {
            const bans = await interaction.guild.bans.fetch();

            let choices = bans.map(ban => {
                const user = ban.user;
                return {
                    name: `${user.id} (${user.tag})`,
                    value: user.id
                };
            });

            if (focused && focused.length > 0) {
                const query = focused.toLowerCase();
                choices = choices.filter(choice =>
                    choice.value.startsWith(query) ||
                    choice.name.toLowerCase().includes(query)
                );
            }

            choices = choices.slice(0, 25);

            await interaction.respond(choices);
        } catch (error) {
            logger.error(`Error in unban autocomplete: ${error.message}`);
            if (!interaction.responded) {
                await interaction.respond([]);
            }
        }
    }

    async handleKick(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.KickMembers)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per kickare!', ephemeral: true });
            return;
        }

        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'Nessun motivo specificato';

        try {
            await member.kick(reason);
            
            const embed = new EmbedBuilder()
                .setTitle('👢 Utente Kickato')
                .setDescription(`**${member.user.tag}** è stato kickato`)
                .addFields({ name: 'Motivo', value: reason })
                .setColor(0xffa500)
                .setFooter({ text: `Kickato da ${interaction.user.tag}` });

            await interaction.reply({ embeds: [embed] });
            logger.info(`${member.user.tag} kicked by ${interaction.user.tag}: ${reason}`);
        } catch (error) {
            await interaction.reply({ content: `❌ modCog.Errore3: ${error.message}`, ephemeral: true });
        }
    }

    async handleMute(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.ModerateMembers)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per mutare!', ephemeral: true });
            return;
        }

        const member = interaction.options.getMember('user');
        const duration = interaction.options.getString('duration') || '10m';
        const reason = interaction.options.getString('reason') || 'Nessun motivo specificato';

        try {
            const ms = this.parseDuration(duration);
            await member.timeout(ms, reason);
            
            const embed = new EmbedBuilder()
                .setTitle('🔇 Utente Mutato')
                .setDescription(`**${member.user.tag}** è stato mutato per ${duration}`)
                .addFields({ name: 'Motivo', value: reason })
                .setColor(0x808080)
                .setFooter({ text: `Mutato da ${interaction.user.tag}` });

            await interaction.reply({ embeds: [embed] });
            logger.info(`${member.user.tag} muted by ${interaction.user.tag}: ${reason}`);
        } catch (error) {
            await interaction.reply({ content: `❌ modCog.Errore4: ${error.message}`, ephemeral: true });
        }
    }

    async handleUnmute(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.ModerateMembers)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per smutare!', ephemeral: true });
            return;
        }

        const member = interaction.options.getMember('user');

        try {
            await member.timeout(null);
            
            const embed = new EmbedBuilder()
                .setTitle('🔊 Utente Smutato')
                .setDescription(`**${member.user.tag}** è stato smutato`)
                .setColor(0x00ff00)
                .setFooter({ text: `Smutato da ${interaction.user.tag}` });

            await interaction.reply({ embeds: [embed] });
            logger.info(`${member.user.tag} unmuted by ${interaction.user.tag}`);
        } catch (error) {
            await interaction.reply({ content: `❌ modCog.Errore5: ${error.message}`, ephemeral: true });
        }
    }

    async handleWarnAdd(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.ModerateMembers)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per dare warn!', ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        if (!this.warns[user.id]) this.warns[user.id] = [];
        
        this.warns[user.id].push({
            reason,
            moderator: interaction.user.id,
            timestamp: Date.now()
        });
        
        this.saveWarns();

        const embed = new EmbedBuilder()
            .setTitle('⚠️ Warn Aggiunto')
            .setDescription(`**${user.tag}** ha ricevuto un warn`)
            .addFields(
                { name: 'Motivo', value: reason },
                { name: 'Warn Totali', value: this.warns[user.id].length.toString() }
            )
            .setColor(0xffff00)
            .setFooter({ text: `Warn dato da ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
        logger.info(`Warn added to ${user.tag} by ${interaction.user.tag}: ${reason}`);
    }

    async handleWarnList(interaction) {
        const user = interaction.options.getUser('user');
        const userWarns = this.warns[user.id] || [];

        if (userWarns.length === 0) {
            await interaction.reply({ content: `${user.tag} non ha warn.`, ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`⚠️ Warn di ${user.tag}`)
            .setDescription(`Totale: ${userWarns.length} warn`)
            .setColor(0xffff00);

        userWarns.slice(-5).forEach((warn, index) => {
            const date = new Date(warn.timestamp).toLocaleDateString();
            embed.addFields({
                name: `Warn ${index + 1}`,
                value: `**Motivo:** ${warn.reason}\n**Data:** ${date}`,
                inline: false
            });
        });

        await interaction.reply({ embeds: [embed] });
    }

    async handleWarnRemove(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.ModerateMembers)(interaction)) {
            await interaction.reply({ content: '�?O Non hai i permessi per rimuovere warn!', ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user');
        const warnId = interaction.options.getInteger('id');
        const userWarns = this.warns[user.id] || [];

        if (!userWarns.length) {
            await interaction.reply({ content: `${user.tag} non ha warn.`, ephemeral: true });
            return;
        }

        const index = warnId - 1;
        if (index < 0 || index >= userWarns.length) {
            await interaction.reply({ content: `ID non valido. Usa un numero tra 1 e ${userWarns.length} (vedi /warn list).`, ephemeral: true });
            return;
        }

        const [removed] = userWarns.splice(index, 1);
        this.warns[user.id] = userWarns;
        this.saveWarns();

        const removedDate = removed?.timestamp ? new Date(removed.timestamp).toLocaleString() : 'sconosciuta';
        await interaction.reply({ content: `�o. Rimosso warn #${warnId} di ${user.tag} (motivo: ${removed?.reason || 'n/d'}, data: ${removedDate}).`, ephemeral: true });
        logger.info(`Warn #${warnId} removed for ${user.tag} by ${interaction.user.tag}`);
    }

    async handleWarnClear(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.ModerateMembers)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per rimuovere warn!', ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user');
        delete this.warns[user.id];
        this.saveWarns();

        await interaction.reply({ content: `✅ Tutti i warn di ${user.tag} sono stati rimossi.` });
        logger.info(`All warns cleared for ${user.tag} by ${interaction.user.tag}`);
    }

    async handleNick(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.ManageNicknames)(interaction)) {
            await interaction.reply({ content: '❌ Non hai i permessi per cambiare nickname!', ephemeral: true });
            return;
        }

        const member = interaction.options.getMember('user');
        const nick = interaction.options.getString('nick');

        try {
            await member.setNickname(nick);
            await interaction.reply({ content: `✅ Nickname di ${member.user.tag} cambiato in "${nick}"` });
            logger.info(`Nickname changed for ${member.user.tag} to "${nick}" by ${interaction.user.tag}`);
        } catch (error) {
            await interaction.reply({ content: `❌ modCog.Errore6: ${error.message}`, ephemeral: true });
        }
    }

    parseDuration(duration) {
        const match = duration.match(/^(\d+)([smhd])$/);
        if (!match) return 10 * 60 * 1000;
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 10 * 60 * 1000;
        }
    }
    async handleUserContext(interaction) {
        const action = interaction.commandName.toLowerCase();
        const target = interaction.targetMember;

        if (!target) {
            return interaction.reply({
                content: '❌ Utente non valido.',
                ephemeral: true
            });
        }

        const permMap = {
            ban: PermissionFlagsBits.BanMembers,
            kick: PermissionFlagsBits.KickMembers,
            timeout: PermissionFlagsBits.ModerateMembers
        };

        const neededPerm = permMap[action];

        if (neededPerm && !ownerOrHasPermissions(neededPerm)(interaction)) {
            return interaction.reply({
                content: `❌ Non hai il permesso per usare **${interaction.commandName}**.`,
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`mod_${action}_${target.id}`)
            .setTitle(`${interaction.commandName} - ${target.user.username}`);

        const rows = [];

        if (action === 'timeout') {
            const durationInput = new TextInputBuilder()
                .setCustomId('duration')
                .setLabel('Durata (es: 10m, 1h, 1d)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            rows.push(new ActionRowBuilder().addComponents(durationInput));
        }

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Motivo')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        rows.push(new ActionRowBuilder().addComponents(reasonInput));

        modal.addComponents(...rows);
        await interaction.showModal(modal);
    }


    async handleModerationModal(interaction) {
        let preAction = interaction.customId.split('_');
        let action;
        if (preAction[0] !== 'ticket' ) { action = preAction[1] } else { action = interaction.customId };
        console.log(interaction.customId)
        let userId = preAction[2]
		if (preAction[0].startsWith('ticket')) userId = interaction.user.id
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) {
            return interaction.reply({
                content: '❌ Utente non trovato.',
                ephemeral: true
            });
        }

        let reason = 'Nessun motivo specificato';
        if (interaction.fields.fields.has('reason')) {
            reason = interaction.fields.getTextInputValue('reason');
        }

        const permMap = {
            ban: PermissionFlagsBits.BanMembers,
            kick: PermissionFlagsBits.KickMembers,
            timeout: PermissionFlagsBits.ModerateMembers
        };

        const neededPerm = permMap[action];
        if (neededPerm && !ownerOrHasPermissions(neededPerm)(interaction)) {
            return interaction.reply({
                content: '❌ Permessi insufficienti.',
                ephemeral: true
            });
        }

        try {
            if (action === 'ban') {
                await member.ban({ reason });
            }

            if (action === 'kick') {
                await member.kick(reason);
            }

            if (action === 'timeout') {
                if (!interaction.fields.fields.has('duration')) {
                    return interaction.reply({
                        content: '❌ Durata mancante.',
                        ephemeral: true
                    });
                }

                const durationRaw = interaction.fields.getTextInputValue('duration');
                const ms = this.parseDuration(durationRaw);
                await member.timeout(ms, reason);
            }
            
            if (!preAction[0].startsWith('ticket')) {
                await interaction.reply({
                    content: `✅ **${action.toUpperCase()}** eseguito su **${member.user.tag}**`,
                    ephemeral: true
                });
            };

        } catch (error) {
            console.log(error)
            await interaction.reply({
                content: `❌ modCog.Errore7: ${error.message}`,
                ephemeral: true
            });
        }
    }
}

function setup(client) {
    const moderationCog = new ModerationCog(client);
    
    client.on('interactionCreate', async (interaction) => {
        try {
            if (interaction.isModalSubmit()) {
                return moderationCog.handleModerationModal(interaction);
            }

            if (interaction.isAutocomplete()) {
                if (interaction.commandName === 'unban') {
                    const focused = interaction.options.getFocused(true);
                    if (focused.name === 'id') await moderationCog.handleUnbanAutocomplete(interaction);
                }
                return;
            }
            if (interaction.isUserContextMenuCommand()) {
                return moderationCog.handleUserContext(interaction);
            }

            if (!interaction.isChatInputCommand()) return;
            
            switch (interaction.commandName) {
                case 'ban': await moderationCog.handleBan(interaction); break;
                case 'kick': await moderationCog.handleKick(interaction); break;
                case 'mute': await moderationCog.handleMute(interaction); break;
                case 'unmute': await moderationCog.handleUnmute(interaction); break;
                case 'unban': await moderationCog.handleUnban(interaction); break;
                case 'nick': await moderationCog.handleNick(interaction); break;
                case 'warn':
                    const subcommand = interaction.options.getSubcommand();
                    switch (subcommand) {
                        case 'add': await moderationCog.handleWarnAdd(interaction); break;
                        case 'list': await moderationCog.handleWarnList(interaction); break;
                        case 'remove': await moderationCog.handleWarnRemove(interaction); break;
                        case 'clear': await moderationCog.handleWarnClear(interaction); break;
                    }
                    break;
            }
        } catch (error) {
            logger.error(`Error in moderation command: ${error.message}`);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Errore nel comando.', ephemeral: true });
            }
        }
    });
    
    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(
        ...moderationCog.commands,
        ...moderationCog.contextMenus
    );
    return moderationCog;
}

module.exports = { setup, ModerationCog };
