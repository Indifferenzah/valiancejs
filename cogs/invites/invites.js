const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const logger = require('../../utils/logger');
const path = require('path');

class InviteCog {
    constructor(client) {
        this.client = client;

        // DB
        this.dbPath = path.join(__dirname, 'invites.json');
        this.db = loadJsonSync(this.dbPath, {});

        // Config globale
        const globalConfig = loadJsonSync(
            path.join(__dirname, '../../config.json'),
            {}
        );

        // 🔥 FIX STRUTTURA CONFIG
        this.cfg = {
            embeds: globalConfig.invites_embeds || {},
            messages: globalConfig.invites_embeds?.admin || {}
        };

        this.inviteCache = new Map();

        this.commands = [
            new SlashCommandBuilder()
                .setName('invites')
                .setDescription('Mostra gli inviti di un utente')
                .addUserOption(o =>
                    o.setName('user')
                        .setDescription('Utente di cui vedere gli inviti')
                        .setRequired(false)
                ),

            new SlashCommandBuilder()
                .setName('inviteleaderboard')
                .setDescription('Mostra la leaderboard degli inviti'),

            new SlashCommandBuilder()
                .setName('invite')
                .setDescription('Comandi admin inviti')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addSubcommand(sc =>
                    sc.setName('set')
                        .setDescription('Imposta il numero di inviti di un utente')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Utente target')
                                .setRequired(true)
                        )
                        .addIntegerOption(o =>
                            o.setName('amount')
                                .setDescription('Numero di inviti')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('add')
                        .setDescription('Aggiunge inviti a un utente')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Utente target')
                                .setRequired(true)
                        )
                        .addIntegerOption(o =>
                            o.setName('amount')
                                .setDescription('Numero di inviti da aggiungere')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('remove')
                        .setDescription('Rimuove inviti a un utente')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Utente target')
                                .setRequired(true)
                        )
                        .addIntegerOption(o =>
                            o.setName('amount')
                                .setDescription('Numero di inviti da rimuovere')
                                .setRequired(true)
                        )
                )
        ];

        this.init();
    }

    async init() {
        const guild = this.client.guilds.cache.first();
        if (!guild) return;

        try {
            const invites = await guild.invites.fetch();
            invites.forEach(i => this.inviteCache.set(i.code, i.uses));
        } catch (err) {
            logger.warn('[INVITES] Impossibile fetchare inviti', err);
        }
    }

    save() {
        saveJsonSync(this.dbPath, this.db);
    }

    getUserInvites(id) {
        return this.db[id] || 0;
    }

    setUserInvites(id, amount) {
        this.db[id] = Math.max(0, amount);
        this.save();
    }

    addUserInvites(id, amount) {
        this.setUserInvites(id, this.getUserInvites(id) + amount);
    }

    buildEmbed({ author, guild, title, description, color, thumbnail, footer }) {
        return new EmbedBuilder()
            .setAuthor({ name: author.username, iconURL: author.displayAvatarURL() })
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setThumbnail(thumbnail)
            .setFooter({
                text: footer,
                iconURL: guild.iconURL()
            });
    }

    // =====================
    // /invites
    // =====================
    async handleInvites(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const count = this.getUserInvites(user.id);
        const e = this.cfg.embeds.invites;

        const description = e.description
            .replace('{mention}', `<@${user.id}>`)
            .replace('{count}', count);

        const embed = this.buildEmbed({
            author: user,
            guild: interaction.guild,
            title: e.title,
            description,
            color: e.color,
            thumbnail: e.thumbnail,
            footer: e.footer
        });

        await interaction.reply({ embeds: [embed] });
    }

    // =====================
    // /inviteleaderboard + bottoni
    // =====================
    async handleLeaderboard(interaction, page = 0) {
        const e = this.cfg.embeds.leaderboard;

        const entries = Object.entries(this.db)
            .sort((a, b) => b[1] - a[1]);

        const perPage = 10;
        const slice = entries.slice(page * perPage, (page + 1) * perPage);

        const description = slice.length
            ? slice.map(([id, count], i) =>
                e.row
                    .replace('{position}', page * perPage + i + 1)
                    .replace('{user}', `<@${id}>`)
                    .replace('{count}', count)
            ).join('\n')
            : e.empty;

        const embed = this.buildEmbed({
            author: interaction.user,
            guild: interaction.guild,
            title: e.title,
            description,
            color: e.color,
            thumbnail: e.thumbnail,
            footer: e.footer
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`inv_lb_prev_${page}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel('⬅')
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`inv_lb_next_${page}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel('➡')
                .setDisabled((page + 1) * perPage >= entries.length)
        );

        // 🔥 FIX TOTALE reply/update
        const payload = { embeds: [embed], components: [row] };

        if (interaction.isButton()) {
            await interaction.update(payload);
        } else {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(payload);
            } else {
                await interaction.reply(payload);
            }
        }
    }

    // =====================
    // /invite admin
    // =====================
    async handleAdmin(interaction, type) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            return interaction.reply({
                content: this.cfg.messages.no_permission,
                ephemeral: true
            });
        }

        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (type === 'set') this.setUserInvites(user.id, amount);
        if (type === 'add') this.addUserInvites(user.id, amount);
        if (type === 'remove') this.addUserInvites(user.id, -amount);

        await interaction.reply({
            content: this.cfg.messages.success.replace('{user}', user.tag)
        });
    }
}

// =====================
// SETUP
// =====================
function setup(client) {
    const cog = new InviteCog(client);

    client.on('interactionCreate', async interaction => {
        try {
            if (interaction.isButton()) {
                const [, , dir, page] = interaction.customId.split('_');
                const newPage = dir === 'next'
                    ? Number(page) + 1
                    : Number(page) - 1;

                return cog.handleLeaderboard(interaction, newPage);
            }

            if (!interaction.isChatInputCommand()) return;

            if (interaction.commandName === 'invites')
                return cog.handleInvites(interaction);

            if (interaction.commandName === 'inviteleaderboard')
                return cog.handleLeaderboard(interaction);

            if (interaction.commandName === 'invite')
                return cog.handleAdmin(interaction, interaction.options.getSubcommand());

        } catch (err) {
            logger.error('[INVITES] Interaction error', err);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Errore interno.',
                    ephemeral: true
                });
            }
        }
    });

    // =====================
    // PREFIX COMMANDS (LOCAL ONLY)
    // =====================
    client.on('messageCreate', async message => {
        try {
            if (!message.guild || message.author.bot) return;

            const PREFIXES = ['.'];
            const prefix = PREFIXES.find(p => message.content.startsWith(p));
            if (!prefix) return;

            const args = message.content.slice(prefix.length).trim().split(/\s+/);
            const cmd = args.shift()?.toLowerCase();

            // ---------------------
            // .invites [@user]
            // ---------------------
            if (cmd === 'invites') {
                const user = message.mentions.users.first() || message.author;
                const count = cog.getUserInvites(user.id);
                const e = cog.cfg.embeds.invites;

                const description = e.description
                    .replace('{mention}', `<@${user.id}>`)
                    .replace('{count}', count);

                const embed = cog.buildEmbed({
                    author: user,
                    guild: message.guild,
                    title: e.title,
                    description,
                    color: e.color,
                    thumbnail: e.thumbnail,
                    footer: e.footer
                });

                return message.channel.send({ embeds: [embed] });
            }

            // ---------------------
            // .leaderboard | .lb
            // ---------------------
            if (cmd === 'leaderboard' || cmd === 'lb') {
                const e = cog.cfg.embeds.leaderboard;

                const entries = Object.entries(cog.db)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);

                const description = entries.length
                    ? entries.map(([id, count], i) =>
                        e.row
                            .replace('{position}', i + 1)
                            .replace('{user}', `<@${id}>`)
                            .replace('{count}', count)
                    ).join('\n')
                    : e.empty;

                const embed = cog.buildEmbed({
                    author: message.author,
                    guild: message.guild,
                    title: e.title,
                    description,
                    color: e.color,
                    thumbnail: e.thumbnail,
                    footer: e.footer
                });

                return message.channel.send({ embeds: [embed] });
            }

        } catch (err) {
            logger.error('[INVITES] Prefix command error', err);
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.commands);

    return cog;
}

module.exports = { setup, InviteCog };
