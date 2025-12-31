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

const MODULE_NAME = 'INVITES';
const ITEMS_PER_PAGE = 10;
const COMMAND_PREFIXES = ['.'];

const MESSAGES = {
    ERROR: {
        INTERNAL: '⚠️ Si è verificato un errore interno durante l\'elaborazione della richiesta. Riprova più tardi.',
        NO_PERMISSION: '🚫 **Accesso Negato** — Non hai i permessi necessari per eseguire questo comando.',
        INVALID_PAGE: '📄 **Pagina Non Valida** — La pagina richiesta non esiste.',
        USER_NOT_FOUND: '👤 **Utente Non Trovato** — L\'utente specificato non è stato trovato.',
        NO_DATA: '📊 **Nessun Dato Disponibile** — Non ci sono attualmente statistiche inviti da visualizzare.'
    },
    SUCCESS: {
        INVITE_SET: '✅ **Inviti Aggiornati** — Impostati con successo **{amount}** inviti per **{user}**.',
        INVITE_ADDED: '✅ **Inviti Aggiunti** — Aggiunti con successo **{amount}** inviti all\'account di **{user}**.',
        INVITE_REMOVED: '✅ **Inviti Rimossi** — Rimossi con successo **{amount}** inviti dall\'account di **{user}**.',
        CACHE_INITIALIZED: 'Cache inviti inizializzata con successo con {count} inviti attivi.',
        MEMBER_TRACKED: 'Membro {member} entrato tramite invito di {inviter} (Codice: {code}).'
    },
    INFO: {
        PROCESSING: '⏳ Elaborazione richiesta in corso...',
        LOADING: '🔄 Caricamento dati inviti...'
    }
};

class InviteTrackerCog {
    constructor(client) {
        this.client = client;

        this.dbPath = path.join(__dirname, 'invites.json');
        this.db = this._loadDatabase();

        this.config = this._loadConfiguration();

        this.inviteCache = new Map();

        this.commands = this._registerCommands();

        this._initialize();
    }

    _loadDatabase() {
        try {
            const db = loadJsonSync(this.dbPath, {});
            logger.info(`[${MODULE_NAME}] Database loaded successfully.`);
            return db;
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Failed to load database:`, error);
            return {};
        }
    }

    _loadConfiguration() {
        try {
            const globalConfig = loadJsonSync(
                path.join(__dirname, '../../config.json'),
                {}
            );

            return {
                embeds: globalConfig.invites_embeds || {},
                messages: globalConfig.invites_embeds?.admin || {}
            };
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Failed to load configuration:`, error);
            return { embeds: {}, messages: {} };
        }
    }

    _registerCommands() {
        return [
            new SlashCommandBuilder()
                .setName('invites')
                .setDescription('📨 Sistema avanzato di tracciamento e gestione inviti')
                .addSubcommand(sc =>
                    sc.setName('user')
                        .setDescription('📊 Mostra le statistiche inviti di un utente')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Utente target (predefinito: te stesso)')
                                .setRequired(false)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('leaderboard')
                        .setDescription('🏆 Visualizza la classifica inviti')
                        .addIntegerOption(o =>
                            o.setName('page')
                                .setDescription('Numero di pagina da visualizzare (predefinito: 1)')
                                .setRequired(false)
                                .setMinValue(1)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('set')
                        .setDescription('⚙️ [ADMIN] Imposta il numero di inviti di un utente')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Utente target')
                                .setRequired(true)
                        )
                        .addIntegerOption(o =>
                            o.setName('amount')
                                .setDescription('Numero di inviti')
                                .setRequired(true)
                                .setMinValue(0)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('add')
                        .setDescription('➕ [ADMIN] Aggiungi inviti al conteggio di un utente')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Utente target')
                                .setRequired(true)
                        )
                        .addIntegerOption(o =>
                            o.setName('amount')
                                .setDescription('Numero di inviti da aggiungere')
                                .setRequired(true)
                                .setMinValue(1)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('remove')
                        .setDescription('➖ [ADMIN] Rimuovi inviti dal conteggio di un utente')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Utente target')
                                .setRequired(true)
                        )
                        .addIntegerOption(o =>
                            o.setName('amount')
                                .setDescription('Numero di inviti da rimuovere')
                                .setRequired(true)
                                .setMinValue(1)
                        )
                )
        ];
    }

    async _initialize() {
        const guild = this.client.guilds.cache.first();
        
        if (!guild) {
            logger.warn(`[${MODULE_NAME}] No guild found during initialization.`);
            return;
        }

        try {
            const invites = await guild.invites.fetch();
            
            invites.forEach(invite => {
                this.inviteCache.set(invite.code, {
                    uses: invite.uses,
                    inviter: invite.inviter?.id,
                    code: invite.code
                });
            });

            logger.info(
                `[${MODULE_NAME}] ${MESSAGES.SUCCESS.CACHE_INITIALIZED.replace('{count}', this.inviteCache.size)}`
            );
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Initialization failed:`, error);
        }
    }

    _saveDatabase() {
        try {
            saveJsonSync(this.dbPath, this.db);
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Failed to save database:`, error);
        }
    }

    getUserInvites(userId) {
        return this.db[userId] || 0;
    }

    setUserInvites(userId, amount) {
        this.db[userId] = Math.max(0, amount);
        this._saveDatabase();
        
        logger.info(`[${MODULE_NAME}] Set invites for user ${userId} to ${amount}.`);
    }

    modifyUserInvites(userId, delta) {
        const currentCount = this.getUserInvites(userId);
        const newCount = Math.max(0, currentCount + delta);
        
        this.setUserInvites(userId, newCount);
    }

    getLeaderboardData() {
        return Object.entries(this.db)
            .sort((a, b) => b[1] - a[1]);
    }

    createEmbed({ author, guild, title, description, color, thumbnail, footer, fields = [] }) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setThumbnail(thumbnail)
            .setTimestamp()
            .setFooter({
                text: footer,
                iconURL: guild?.iconURL() || undefined
            });

        if (author) {
            embed.setAuthor({
                name: author.username,
                iconURL: author.displayAvatarURL({ dynamic: true })
            });
        }

        if (fields.length > 0) {
            embed.addFields(fields);
        }

        return embed;
    }

    async handleUserCommand(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const inviteCount = this.getUserInvites(targetUser.id);
            const embedConfig = this.config.embeds.invites;

            if (!embedConfig) {
                return interaction.reply({
                    content: MESSAGES.ERROR.INTERNAL,
                    ephemeral: true
                });
            }

            const description = embedConfig.description
                .replace('{mention}', `<@${targetUser.id}>`)
                .replace('{count}', inviteCount);

            const embed = this.createEmbed({
                author: targetUser,
                guild: interaction.guild,
                title: embedConfig.title,
                description,
                color: embedConfig.color,
                thumbnail: embedConfig.thumbnail,
                footer: embedConfig.footer
            });

            await interaction.reply({ embeds: [embed] });
            
            logger.info(`[${MODULE_NAME}] User ${interaction.user.tag} checked invites for ${targetUser.tag}.`);
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Error in handleUserCommand:`, error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: MESSAGES.ERROR.INTERNAL,
                    ephemeral: true
                });
            }
        }
    }

    async handleLeaderboardCommand(interaction, page = 0) {
        try {
            const embedConfig = this.config.embeds.leaderboard;

            if (!embedConfig) {
                return interaction.reply({
                    content: MESSAGES.ERROR.INTERNAL,
                    ephemeral: true
                });
            }

            const leaderboardData = this.getLeaderboardData();
            const totalPages = Math.max(1, Math.ceil(leaderboardData.length / ITEMS_PER_PAGE));

            if (page >= totalPages) page = totalPages - 1;
            if (page < 0) page = 0;

            const startIndex = page * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const pageData = leaderboardData.slice(startIndex, endIndex);

            const description = pageData.length > 0
                ? pageData.map(([userId, inviteCount], index) => {
                    const position = startIndex + index + 1;
                    return embedConfig.row
                        .replace('{position}', position)
                        .replace('{user}', `<@${userId}>`)
                        .replace('{count}', inviteCount);
                }).join('\n')
                : embedConfig.empty;

            const embed = this.createEmbed({
                author: interaction.user,
                guild: interaction.guild,
                title: `${embedConfig.title} — Page ${page + 1} of ${totalPages}`,
                description,
                color: embedConfig.color,
                thumbnail: embedConfig.thumbnail,
                footer: `${embedConfig.footer} • Total Members: ${leaderboardData.length}`
            });

            const navigationRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`inv_lb_prev_${page}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel('◀ Previous')
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`inv_lb_page_${page}`)
                    .setStyle(ButtonStyle.Primary)
                    .setLabel(`Page ${page + 1}/${totalPages}`)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`inv_lb_next_${page}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel('Next ▶')
                    .setDisabled(page >= totalPages - 1)
            );

            const payload = {
                embeds: [embed],
                components: [navigationRow]
            };

            if (interaction.isButton()) {
                await interaction.update(payload);
            } else {
                await interaction.reply(payload);
            }

            logger.info(`[${MODULE_NAME}] Leaderboard displayed (Page ${page + 1}) for ${interaction.user.tag}.`);
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Error in handleLeaderboardCommand:`, error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: MESSAGES.ERROR.INTERNAL,
                    ephemeral: true
                });
            }
        }
    }

    async handleAdminCommand(interaction, action) {
        try {
            if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
                return interaction.reply({
                    content: this.config.messages.no_permission || MESSAGES.ERROR.NO_PERMISSION,
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');

            if (!targetUser) {
                return interaction.reply({
                    content: MESSAGES.ERROR.USER_NOT_FOUND,
                    ephemeral: true
                });
            }

            let responseMessage;
            const previousCount = this.getUserInvites(targetUser.id);

            switch (action) {
                case 'set':
                    this.setUserInvites(targetUser.id, amount);
                    responseMessage = MESSAGES.SUCCESS.INVITE_SET
                        .replace('{user}', targetUser.tag)
                        .replace('{amount}', amount);
                    break;

                case 'add':
                    this.modifyUserInvites(targetUser.id, amount);
                    responseMessage = MESSAGES.SUCCESS.INVITE_ADDED
                        .replace('{user}', targetUser.tag)
                        .replace('{amount}', amount);
                    break;

                case 'remove':
                    this.modifyUserInvites(targetUser.id, -amount);
                    responseMessage = MESSAGES.SUCCESS.INVITE_REMOVED
                        .replace('{user}', targetUser.tag)
                        .replace('{amount}', amount);
                    break;

                default:
                    return interaction.reply({
                        content: MESSAGES.ERROR.INTERNAL,
                        ephemeral: true
                    });
            }

            const newCount = this.getUserInvites(targetUser.id);

            const embed = new EmbedBuilder()
                .setTitle('✅ Azione Amministrativa Completata')
                .setColor(0x00FF00)
                .addFields([
                    { name: '👤 Utente Destinatario', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: '⚙️ Azione', value: action.toUpperCase(), inline: true },
                    { name: '🔢 Quantità', value: amount.toString(), inline: true },
                    { name: '📊 Conteggio Precedente', value: previousCount.toString(), inline: true },
                    { name: '📈 Nuovo Conteggio', value: newCount.toString(), inline: true },
                    { name: '🔄 Variazione', value: `${newCount >= previousCount ? '+' : ''}${newCount - previousCount}`, inline: true }
                ])
                .setFooter({ text: `Eseguito da ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

            logger.info(
                `[${MODULE_NAME}] Admin ${interaction.user.tag} executed ${action} for ${targetUser.tag}: ${previousCount} → ${newCount}`
            );
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Error in handleAdminCommand:`, error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: MESSAGES.ERROR.INTERNAL,
                    ephemeral: true
                });
            }
        }
    }

    async handlePrefixUserCommand(message, targetUser = null) {
        try {
            const user = targetUser || message.author;
            const inviteCount = this.getUserInvites(user.id);
            const embedConfig = this.config.embeds.invites;

            if (!embedConfig) return;

            const description = embedConfig.description
                .replace('{mention}', `<@${user.id}>`)
                .replace('{count}', inviteCount);

            const embed = this.createEmbed({
                author: user,
                guild: message.guild,
                title: embedConfig.title,
                description,
                color: embedConfig.color,
                thumbnail: embedConfig.thumbnail,
                footer: embedConfig.footer
            });

            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Error in handlePrefixUserCommand:`, error);
        }
    }

    async handlePrefixLeaderboardCommand(message) {
        try {
            const embedConfig = this.config.embeds.leaderboard;

            if (!embedConfig) return;

            const leaderboardData = this.getLeaderboardData().slice(0, ITEMS_PER_PAGE);

            const description = leaderboardData.length > 0
                ? leaderboardData.map(([userId, inviteCount], index) =>
                    embedConfig.row
                        .replace('{position}', index + 1)
                        .replace('{user}', `<@${userId}>`)
                        .replace('{count}', inviteCount)
                ).join('\n')
                : embedConfig.empty;

            const embed = this.createEmbed({
                author: message.author,
                guild: message.guild,
                title: embedConfig.title,
                description,
                color: embedConfig.color,
                thumbnail: embedConfig.thumbnail,
                footer: embedConfig.footer
            });

            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Error in handlePrefixLeaderboardCommand:`, error);
        }
    }

    async handleMemberJoin(member) {
        try {
            const guild = member.guild;
            const currentInvites = await guild.invites.fetch();

            let usedInvite = null;
            let inviter = null;

            currentInvites.forEach(invite => {
                const cachedData = this.inviteCache.get(invite.code);
                
                if (cachedData && invite.uses > cachedData.uses) {
                    usedInvite = invite;
                    inviter = invite.inviter;
                    
                    this.inviteCache.set(invite.code, {
                        uses: invite.uses,
                        inviter: inviter?.id,
                        code: invite.code
                    });
                }
            });

            if (inviter && usedInvite) {
                this.modifyUserInvites(inviter.id, 1);
                
                logger.info(
                    `[${MODULE_NAME}] ${MESSAGES.SUCCESS.MEMBER_TRACKED
                        .replace('{member}', member.user.tag)
                        .replace('{inviter}', inviter.tag)
                        .replace('{code}', usedInvite.code)}`
                );
            } else {
                logger.warn(`[${MODULE_NAME}] Unable to determine invite source for ${member.user.tag}.`);
            }
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Error tracking member join:`, error);
        }
    }

    handleInviteCreate(invite) {
        this.inviteCache.set(invite.code, {
            uses: invite.uses,
            inviter: invite.inviter?.id,
            code: invite.code
        });
        
        logger.debug(`[${MODULE_NAME}] Cached new invite: ${invite.code}`);
    }

    handleInviteDelete(invite) {
        this.inviteCache.delete(invite.code);
        
        logger.debug(`[${MODULE_NAME}] Removed cached invite: ${invite.code}`);
    }
}

function setup(client) {
    logger.info(`[${MODULE_NAME}] Initializing Invite Tracking System...`);
    
    const cog = new InviteTrackerCog(client);

    client.on('guildMemberAdd', async (member) => {
        await cog.handleMemberJoin(member);
    });

    client.on('inviteCreate', (invite) => {
        cog.handleInviteCreate(invite);
    });

    client.on('inviteDelete', (invite) => {
        cog.handleInviteDelete(invite);
    });

    client.on('interactionCreate', async (interaction) => {
        try {
            if (interaction.isButton() && interaction.customId.startsWith('inv_lb_')) {
                const parts = interaction.customId.split('_');
                const direction = parts[2];
                const currentPage = parseInt(parts[3], 10);

                const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
                
                await cog.handleLeaderboardCommand(interaction, newPage);
                return;
            }

            if (interaction.isChatInputCommand() && interaction.commandName === 'invites') {
                const subcommand = interaction.options.getSubcommand();

                switch (subcommand) {
                    case 'user':
                        await cog.handleUserCommand(interaction);
                        break;

                    case 'leaderboard':
                        const requestedPage = (interaction.options.getInteger('page') || 1) - 1;
                        await cog.handleLeaderboardCommand(interaction, requestedPage);
                        break;

                    case 'set':
                    case 'add':
                    case 'remove':
                        await cog.handleAdminCommand(interaction, subcommand);
                        break;

                    default:
                        await interaction.reply({
                            content: MESSAGES.ERROR.INTERNAL,
                            ephemeral: true
                        });
                }
            }
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Error handling interaction:`, error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: MESSAGES.ERROR.INTERNAL,
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });

    client.on('messageCreate', async (message) => {
        try {
            if (!message.guild || message.author.bot) return;

            const prefix = COMMAND_PREFIXES.find(p => message.content.startsWith(p));
            if (!prefix) return;

            const args = message.content.slice(prefix.length).trim().split(/\s+/);
            const command = args.shift()?.toLowerCase();

            if (!command) return;

            switch (command) {
                case 'i':
                case 'invites':
                    const mentionedUser = message.mentions.users.first();
                    await cog.handlePrefixUserCommand(message, mentionedUser);
                    break;

                case 'lb':
                case 'leaderboard':
                    await cog.handlePrefixLeaderboardCommand(message);
                    break;
            }
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Error handling prefix command:`, error);
        }
    });

    if (!client.globalCommands) {
        client.globalCommands = [];
    }
    
    client.globalCommands.push(...cog.commands);

    logger.info(`[${MODULE_NAME}] Invite Tracking System initialized successfully.`);
    
    return cog;
}

module.exports = { setup, InviteTrackerCog };