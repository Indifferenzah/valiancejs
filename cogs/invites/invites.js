/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     VALIANCE INVITE TRACKING SYSTEM                         ║
 * ║                         Enterprise-Grade Module                             ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Description: Advanced invite tracking and management system with           ║
 * ║               real-time monitoring, leaderboard analytics, and              ║
 * ║               administrative controls.                                       ║
 * ║                                                                              ║
 * ║  Features:    - Real-time invite tracking                                   ║
 * ║               - Persistent data storage                                     ║
 * ║               - Interactive leaderboard with pagination                     ║
 * ║               - Administrative management commands                          ║
 * ║               - Prefix and slash command support                            ║
 * ║               - Automated invite attribution                                ║
 * ║                                                                              ║
 * ║  Version:     2.0.0                                                          ║
 * ║  Author:      Valiance Development Team                                     ║
 * ║  Last Update: 2025-12-31                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const MODULE_NAME = 'INVITES';
const ITEMS_PER_PAGE = 10;
const COMMAND_PREFIXES = ['.'];

const MESSAGES = {
    ERROR: {
        INTERNAL: '⚠️ An internal error occurred while processing your request. Please try again later.',
        NO_PERMISSION: '🚫 **Access Denied** — You do not have the required permissions to execute this command.',
        INVALID_PAGE: '📄 **Invalid Page** — The requested page does not exist.',
        USER_NOT_FOUND: '👤 **User Not Found** — The specified user could not be located.',
        NO_DATA: '📊 **No Data Available** — There are currently no invite statistics to display.'
    },
    SUCCESS: {
        INVITE_SET: '✅ **Invite Count Updated** — Successfully set **{user}**\'s invite count to **{amount}**.',
        INVITE_ADDED: '✅ **Invites Added** — Successfully added **{amount}** invites to **{user}**\'s account.',
        INVITE_REMOVED: '✅ **Invites Removed** — Successfully removed **{amount}** invites from **{user}**\'s account.',
        CACHE_INITIALIZED: 'Invite cache successfully initialized with {count} active invites.',
        MEMBER_TRACKED: 'Member {member} joined via invite from {inviter} (Invite: {code}).'
    },
    INFO: {
        PROCESSING: '⏳ Processing your request...',
        LOADING: '🔄 Loading invite data...'
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COG CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * InviteTrackerCog — Enterprise-grade invite tracking and management system
 * 
 * This class provides comprehensive invite tracking functionality including:
 * - Automatic invite attribution when members join
 * - Real-time invite count synchronization
 * - Interactive leaderboard with pagination
 * - Administrative tools for manual invite management
 * - Multi-format command support (slash and prefix)
 * 
 * @class InviteTrackerCog
 */
class InviteTrackerCog {
    /**
     * Initialize the Invite Tracker Cog
     * @param {Client} client - Discord.js client instance
     */
    constructor(client) {
        this.client = client;
        
        // ─────────────────────────────────────────────────────────────────────
        // Database Configuration
        // ─────────────────────────────────────────────────────────────────────
        this.dbPath = path.join(__dirname, 'invites.json');
        this.db = this._loadDatabase();

        // ─────────────────────────────────────────────────────────────────────
        // Configuration Loading
        // ─────────────────────────────────────────────────────────────────────
        this.config = this._loadConfiguration();

        // ─────────────────────────────────────────────────────────────────────
        // Invite Cache for Real-time Tracking
        // ─────────────────────────────────────────────────────────────────────
        this.inviteCache = new Map();

        // ─────────────────────────────────────────────────────────────────────
        // Command Registration
        // ─────────────────────────────────────────────────────────────────────
        this.commands = this._registerCommands();

        // ─────────────────────────────────────────────────────────────────────
        // Initialize Tracking System
        // ─────────────────────────────────────────────────────────────────────
        this._initialize();
    }

    // ───────────────────────────────────────────────────────────────────────────
    // INITIALIZATION METHODS
    // ───────────────────────────────────────────────────────────────────────────

    /**
     * Load database from persistent storage
     * @private
     * @returns {Object} Database object
     */
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

    /**
     * Load configuration from global config file
     * @private
     * @returns {Object} Configuration object
     */
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

    /**
     * Register slash commands for the module
     * @private
     * @returns {Array<SlashCommandBuilder>} Array of command builders
     */
    _registerCommands() {
        return [
            new SlashCommandBuilder()
                .setName('invites')
                .setDescription('📨 Advanced invite tracking and management system')
                .addSubcommand(sc =>
                    sc.setName('user')
                        .setDescription('📊 Display invite statistics for a specific user')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Target user (defaults to yourself)')
                                .setRequired(false)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('leaderboard')
                        .setDescription('🏆 View the invite leaderboard rankings')
                        .addIntegerOption(o =>
                            o.setName('page')
                                .setDescription('Page number to display (default: 1)')
                                .setRequired(false)
                                .setMinValue(1)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('set')
                        .setDescription('⚙️ [ADMIN] Set a user\'s invite count to a specific value')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Target user')
                                .setRequired(true)
                        )
                        .addIntegerOption(o =>
                            o.setName('amount')
                                .setDescription('New invite count')
                                .setRequired(true)
                                .setMinValue(0)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('add')
                        .setDescription('➕ [ADMIN] Add invites to a user\'s count')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Target user')
                                .setRequired(true)
                        )
                        .addIntegerOption(o =>
                            o.setName('amount')
                                .setDescription('Number of invites to add')
                                .setRequired(true)
                                .setMinValue(1)
                        )
                )
                .addSubcommand(sc =>
                    sc.setName('remove')
                        .setDescription('➖ [ADMIN] Remove invites from a user\'s count')
                        .addUserOption(o =>
                            o.setName('user')
                                .setDescription('Target user')
                                .setRequired(true)
                        )
                        .addIntegerOption(o =>
                            o.setName('amount')
                                .setDescription('Number of invites to remove')
                                .setRequired(true)
                                .setMinValue(1)
                        )
                )
        ];
    }

    /**
     * Initialize the invite tracking system
     * Fetches all current invites and populates the cache
     * @private
     */
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

    // ───────────────────────────────────────────────────────────────────────────
    // DATABASE OPERATIONS
    // ───────────────────────────────────────────────────────────────────────────

    /**
     * Persist database changes to disk
     * @private
     */
    _saveDatabase() {
        try {
            saveJsonSync(this.dbPath, this.db);
        } catch (error) {
            logger.error(`[${MODULE_NAME}] Failed to save database:`, error);
        }
    }

    /**
     * Get invite count for a specific user
     * @param {string} userId - Discord user ID
     * @returns {number} Number of invites
     */
    getUserInvites(userId) {
        return this.db[userId] || 0;
    }

    /**
     * Set invite count for a specific user
     * @param {string} userId - Discord user ID
     * @param {number} amount - New invite count
     */
    setUserInvites(userId, amount) {
        this.db[userId] = Math.max(0, amount);
        this._saveDatabase();
        
        logger.info(`[${MODULE_NAME}] Set invites for user ${userId} to ${amount}.`);
    }

    /**
     * Modify invite count for a specific user
     * @param {string} userId - Discord user ID
     * @param {number} delta - Amount to add (positive) or remove (negative)
     */
    modifyUserInvites(userId, delta) {
        const currentCount = this.getUserInvites(userId);
        const newCount = Math.max(0, currentCount + delta);
        
        this.setUserInvites(userId, newCount);
    }

    /**
     * Get sorted leaderboard data
     * @returns {Array<[string, number]>} Sorted array of [userId, inviteCount]
     */
    getLeaderboardData() {
        return Object.entries(this.db)
            .sort((a, b) => b[1] - a[1]);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // EMBED BUILDER
    // ───────────────────────────────────────────────────────────────────────────

    /**
     * Build a standardized embed with branding
     * @param {Object} options - Embed options
     * @returns {EmbedBuilder} Configured embed builder
     */
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

    // ───────────────────────────────────────────────────────────────────────────
    // COMMAND HANDLERS - SLASH COMMANDS
    // ───────────────────────────────────────────────────────────────────────────

    /**
     * Handle /invites user command
     * Displays invite statistics for a specific user
     * @param {CommandInteraction} interaction - Discord interaction
     */
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

    /**
     * Handle /invites leaderboard command
     * Displays paginated invite leaderboard
     * @param {CommandInteraction|ButtonInteraction} interaction - Discord interaction
     * @param {number} page - Page number (0-indexed)
     */
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

            // Page validation and bounds checking
            if (page >= totalPages) page = totalPages - 1;
            if (page < 0) page = 0;

            const startIndex = page * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const pageData = leaderboardData.slice(startIndex, endIndex);

            // Build leaderboard description
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

            // Pagination buttons
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

            // Handle different interaction types
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

    /**
     * Handle administrative invite management commands
     * @param {CommandInteraction} interaction - Discord interaction
     * @param {string} action - Action type (set/add/remove)
     */
    async handleAdminCommand(interaction, action) {
        try {
            // Permission verification
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

            // Execute requested action
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

            // Build detailed response embed
            const embed = new EmbedBuilder()
                .setTitle('✅ Administrative Action Completed')
                .setColor(0x00FF00)
                .addFields([
                    { name: '👤 Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: '⚙️ Action', value: action.toUpperCase(), inline: true },
                    { name: '🔢 Amount', value: amount.toString(), inline: true },
                    { name: '📊 Previous Count', value: previousCount.toString(), inline: true },
                    { name: '📈 New Count', value: newCount.toString(), inline: true },
                    { name: '🔄 Change', value: `${newCount >= previousCount ? '+' : ''}${newCount - previousCount}`, inline: true }
                ])
                .setFooter({ text: `Executed by ${interaction.user.tag}` })
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

    // ───────────────────────────────────────────────────────────────────────────
    // COMMAND HANDLERS - PREFIX COMMANDS
    // ───────────────────────────────────────────────────────────────────────────

    /**
     * Handle prefix command for user invites (.i, .invites)
     * @param {Message} message - Discord message
     * @param {User} [targetUser] - Target user (optional)
     */
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

    /**
     * Handle prefix command for leaderboard (.lb, .leaderboard)
     * @param {Message} message - Discord message
     */
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

    // ───────────────────────────────────────────────────────────────────────────
    // EVENT HANDLERS
    // ───────────────────────────────────────────────────────────────────────────

    /**
     * Handle member join event for invite tracking
     * @param {GuildMember} member - Member who joined
     */
    async handleMemberJoin(member) {
        try {
            const guild = member.guild;
            const currentInvites = await guild.invites.fetch();

            let usedInvite = null;
            let inviter = null;

            // Compare current invite uses with cached values
            currentInvites.forEach(invite => {
                const cachedData = this.inviteCache.get(invite.code);
                
                if (cachedData && invite.uses > cachedData.uses) {
                    usedInvite = invite;
                    inviter = invite.inviter;
                    
                    // Update cache
                    this.inviteCache.set(invite.code, {
                        uses: invite.uses,
                        inviter: inviter?.id,
                        code: invite.code
                    });
                }
            });

            // Credit the inviter
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

    /**
     * Handle invite creation event
     * @param {Invite} invite - Created invite
     */
    handleInviteCreate(invite) {
        this.inviteCache.set(invite.code, {
            uses: invite.uses,
            inviter: invite.inviter?.id,
            code: invite.code
        });
        
        logger.debug(`[${MODULE_NAME}] Cached new invite: ${invite.code}`);
    }

    /**
     * Handle invite deletion event
     * @param {Invite} invite - Deleted invite
     */
    handleInviteDelete(invite) {
        this.inviteCache.delete(invite.code);
        
        logger.debug(`[${MODULE_NAME}] Removed cached invite: ${invite.code}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE SETUP & EVENT REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Setup function to initialize the cog and register all event handlers
 * @param {Client} client - Discord.js client instance
 * @returns {InviteTrackerCog} Initialized cog instance
 */
function setup(client) {
    logger.info(`[${MODULE_NAME}] Initializing Invite Tracking System...`);
    
    const cog = new InviteTrackerCog(client);

    // ───────────────────────────────────────────────────────────────────────────
    // EVENT: Guild Member Add
    // ───────────────────────────────────────────────────────────────────────────
    client.on('guildMemberAdd', async (member) => {
        await cog.handleMemberJoin(member);
    });

    // ───────────────────────────────────────────────────────────────────────────
    // EVENT: Invite Create
    // ───────────────────────────────────────────────────────────────────────────
    client.on('inviteCreate', (invite) => {
        cog.handleInviteCreate(invite);
    });

    // ───────────────────────────────────────────────────────────────────────────
    // EVENT: Invite Delete
    // ───────────────────────────────────────────────────────────────────────────
    client.on('inviteDelete', (invite) => {
        cog.handleInviteDelete(invite);
    });

    // ───────────────────────────────────────────────────────────────────────────
    // EVENT: Interaction Create (Slash Commands & Buttons)
    // ───────────────────────────────────────────────────────────────────────────
    client.on('interactionCreate', async (interaction) => {
        try {
            // Handle pagination buttons
            if (interaction.isButton() && interaction.customId.startsWith('inv_lb_')) {
                const parts = interaction.customId.split('_');
                const direction = parts[2];
                const currentPage = parseInt(parts[3], 10);

                const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
                
                await cog.handleLeaderboardCommand(interaction, newPage);
                return;
            }

            // Handle slash commands
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

    // ───────────────────────────────────────────────────────────────────────────
    // EVENT: Message Create (Prefix Commands)
    // ───────────────────────────────────────────────────────────────────────────
    client.on('messageCreate', async (message) => {
        try {
            // Ignore DMs and bot messages
            if (!message.guild || message.author.bot) return;

            // Check for valid prefix
            const prefix = COMMAND_PREFIXES.find(p => message.content.startsWith(p));
            if (!prefix) return;

            // Parse command
            const args = message.content.slice(prefix.length).trim().split(/\s+/);
            const command = args.shift()?.toLowerCase();

            if (!command) return;

            // Execute commands
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

    // ───────────────────────────────────────────────────────────────────────────
    // Register Global Commands
    // ───────────────────────────────────────────────────────────────────────────
    if (!client.globalCommands) {
        client.globalCommands = [];
    }
    
    client.globalCommands.push(...cog.commands);

    logger.info(`[${MODULE_NAME}] Invite Tracking System initialized successfully.`);
    
    return cog;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = { setup, InviteTrackerCog };
