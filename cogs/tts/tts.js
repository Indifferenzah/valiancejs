const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    AudioPlayerStatus
} = require("@discordjs/voice");
const fs = require("fs");
const { loadJsonSync, saveJsonSync } = require("../../utils/jsonStore");
const { ownerOrHasPermissions } = require("../../utils/botUtils");

const path = require("path");
const gTTS = require("gtts");

// ffmpeg PURE npm
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
ffmpeg.setFfmpegPath(ffmpegStatic);

class TTSCog {
    constructor(client) {
        this.client = client;

        this.configPath = path.join(__dirname, "tts.json");
        this.mainConfigPath = path.join(__dirname, "../../config.json");
        this.config = loadJsonSync(this.configPath, {
            channel: null
        });

        this.connections = new Map();
        this.players = new Map();
        this.botVoiceChannel = new Map(); // <guildId, voiceChannelId>

        // QUEUE FIX
        this.queue = new Map();       // <guildId, [messages]>
        this.isPlaying = new Map();   // <guildId, boolean>

        this.commands = [
            new SlashCommandBuilder()
                .setName("tts")
                .setDescription("Sistema TTS gTTS con ffmpeg")
                .addSubcommand(sub =>
                    sub.setName("setchannel")
                        .setDescription("Imposta il canale da cui leggere TTS")
                        .addChannelOption(opt =>
                            opt.setName("channel")
                                .setDescription("Canale testuale")
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName("join")
                        .setDescription("Il bot entra nella tua VC")
                )
                .addSubcommand(sub =>
                    sub.setName("leave")
                        .setDescription("Il bot lascia la VC")
                )
        ];
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    async generateMP3(text, guildId) {
        return new Promise((resolve, reject) => {
            const out = path.join(__dirname, `tts_${guildId}_${Date.now()}.mp3`);
            const tts = new gTTS(text, "it");

            tts.save(out, err => {
                if (err) reject(err);
                else resolve(out);
            });
        });
    }

    async convertToPCM(mp3File) {
        return new Promise((resolve, reject) => {
            const out = mp3File.replace(".mp3", ".wav");

            ffmpeg(mp3File)
                .format("wav")
                .audioFrequency(48000)
                .audioChannels(2)
                .audioCodec("pcm_s16le")
                .on("end", () => resolve(out))
                .on("error", reject)
                .save(out);
        });
    }

    getStatusEmbedConfig(type) {
        try {
            const cfg = loadJsonSync(this.mainConfigPath, {});
            if (cfg?.tts_embeds?.[type]) return cfg.tts_embeds[type];
            if (cfg?.[type]) return cfg[type];
        } catch {
            return null;
        }
        return null;
    }

    parseColor(color) {
        if (typeof color === "number") return color;
        if (typeof color === "string") {
            const cleaned = color.replace("#", "");
            const parsed = parseInt(cleaned, 16);
            if (!Number.isNaN(parsed)) return parsed;
        }
        return null;
    }

    buildStatusEmbed(type, executor, guild, extra = {}) {
        const template = this.getStatusEmbedConfig(type);
        if (!template) return null;

        const avatarURL =
            executor?.displayAvatarURL?.({ dynamic: true }) ||
            executor?.user?.displayAvatarURL?.({ dynamic: true }) ||
            null;
        const username =
            executor?.user?.username ||
            executor?.username ||
            executor?.user?.tag ||
            executor?.tag ||
            "";
        const displayName = executor?.displayName || executor?.globalName || username;
        const mention =
            executor?.toString?.() ||
            (executor?.user?.id ? `<@${executor.user.id}>` : executor?.id ? `<@${executor.id}>` : "");

        const replacements = {
            mention,
            user: displayName,
            channel: extra.channel || ""
        };
        const applyReplacements = (text = "") => {
            if (typeof text !== "string") return text;
            return text
                .replace(/\{mention\}/gi, replacements.mention)
                .replace(/\{user\}/gi, replacements.user)
                .replace(/\{channel\}/gi, replacements.channel);
        };

        const embed = new EmbedBuilder();

        embed.setAuthor({
            name: displayName || replacements.user,
            iconURL: avatarURL
        });

        if (template.title) embed.setTitle(applyReplacements(template.title));
        if (template.description) embed.setDescription(applyReplacements(template.description));

        const color = this.parseColor(template.color);
        if (color !== null) embed.setColor(color);

        if (template.thumbnail) embed.setThumbnail(applyReplacements(template.thumbnail));

        const footerText = template.footer ? applyReplacements(template.footer) : "";
        const footerIcon = guild?.iconURL?.({ dynamic: true }) || null;
        if (footerText || footerIcon) {
            embed.setFooter({
                text: footerText || " ",
                iconURL: footerIcon
            });
        }

        return embed;
    }

    // ========== QUEUE SYSTEM ==========

    async enqueueTTS(guildId, text) {
        const player = this.players.get(guildId);
        const connection = this.connections.get(guildId);

        if (!player || !connection) return;

        if (!this.queue.has(guildId)) {
            this.queue.set(guildId, []);
        }

        this.queue.get(guildId).push(text);

        if (!this.isPlaying.get(guildId)) {
            this.isPlaying.set(guildId, true);
            await this.processQueue(guildId);
        }
    }

    async processQueue(guildId) {
        const queue = this.queue.get(guildId);
        const player = this.players.get(guildId);

        if (!player) {
            this.isPlaying.set(guildId, false);
            return;
        }

        if (!queue || queue.length === 0) {
            this.isPlaying.set(guildId, false);
            return;
        }

        try {
            const text = queue.shift();

            const mp3 = await this.generateMP3(text, guildId);
            const wav = await this.convertToPCM(mp3);

            const resource = createAudioResource(wav, {
                inlineVolume: true,
                metadata: { mp3, wav }
            });
            resource.volume.setVolume(1);

            if (player.state.status !== AudioPlayerStatus.Idle) {
                this.queue.get(guildId).unshift(text);
                return;
            }
            
            player.play(resource);

        } catch (err) {
            console.error("[TTS QUEUE ERROR]", err);
            this.isPlaying.set(guildId, false);
            setTimeout(() => this.processQueue(guildId), 200);
        }
    }

    // ========== SLASH COMMANDS ==========

    async handleSetChannel(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            return interaction.reply({ content: "❌ Non hai i permessi.", ephemeral: true });
        }

        const channel = interaction.options.getChannel("channel");

        if (!channel.isTextBased()) {
            return interaction.reply({
                content: "❌ Devi selezionare un canale testuale!",
                ephemeral: true
            });
        }

        this.config.channel = channel.id;
        this.saveConfig();

        return interaction.reply({
            content: `✔ Canale TTS impostato su <#${channel.id}>`,
            ephemeral: true
        });
    }

    async handleJoin(interaction) {
        const member = interaction.member;

        if (!member.voice.channel) {
            const embed = this.buildStatusEmbed("not_in_channel", member, interaction.guild);
            if (embed) {
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            return interaction.reply({
                content: "❌ Devi essere in un canale vocale!",
                ephemeral: true
            });
        }

        const guildId = interaction.guild.id;

        const connection = joinVoiceChannel({
            channelId: member.voice.channel.id,
            guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator
        });

        const player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Play }
        });

        connection.subscribe(player);

        this.connections.set(guildId, connection);
        this.players.set(guildId, player);

        this.botVoiceChannel.set(guildId, member.voice.channel.id);

        player.on("stateChange", (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle) {
                const meta = oldState.resource?.metadata;
                if (meta?.mp3) fs.unlink(meta.mp3, () => {});
                if (meta?.wav) fs.unlink(meta.wav, () => {});
                this.processQueue(guildId);
            }
        });
        
        player.on("error", error => {
            console.error("[TTS PLAYER ERROR]", error);
        
            this.isPlaying.set(guildId, false);
        
            // tenta di continuare la queue
            setTimeout(() => {
                this.processQueue(guildId);
            }, 250);
        });

        const embed = this.buildStatusEmbed("join", member, interaction.guild, {
            channel: member.voice.channel.name
        });

        if (embed) {
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        return interaction.reply({
            content: `🔊 Entrato in **${member.voice.channel.name}**`,
            ephemeral: true
        });
    }

    async handleLeave(interaction) {
        const guildId = interaction.guild.id;

        const conn = this.connections.get(guildId);
        if (!conn) {
            const embed = this.buildStatusEmbed("no_voice", interaction.member, interaction.guild);
            if (embed) {
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            return interaction.reply({
                content: "❌ Non sono in nessuna voice!",
                ephemeral: true
            });
        }

        const voiceChannelName = interaction.guild.channels.cache.get(conn.joinConfig.channelId)?.name || "";

        conn.destroy();
        this.connections.delete(guildId);
        this.players.delete(guildId);
        this.botVoiceChannel.delete(guildId);

        const embed = this.buildStatusEmbed("leave", interaction.member, interaction.guild, {
            channel: voiceChannelName
        });

        if (embed) {
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        return interaction.reply({
            content: "👋 Disconnesso.",
            ephemeral: true
        });
    }

    // ========== MESSAGE LISTENER FIXATO ==========

    setupListeners() {
        this.client.on("messageCreate", async msg => {
            if (!msg.guild) return;
            if (msg.author.bot) return;

            const guildId = msg.guild.id;
            const botVC = this.botVoiceChannel.get(guildId);

            if (!botVC) return;

            const userVC = msg.member.voice?.channel?.id;

            if (userVC !== botVC) return;

            // Chat testuale settata
            const ttsChannel = this.config.channel;

            // Chat della VC dinamica
            const voiceChat = msg.guild.channels.cache.find(
                c =>
                    c.isTextBased() &&
                    (
                        c.name.toLowerCase().includes(msg.member.voice.channel.name.toLowerCase()) ||
                        c.parentId === msg.member.voice.channel.parentId
                    )
            );

            if (msg.channel.id !== ttsChannel &&
                (!voiceChat || msg.channel.id !== voiceChat.id)) {
                return;
            }

            if (!this.players.has(guildId)) return;
            if (!this.connections.has(guildId)) return;

            await this.enqueueTTS(guildId, msg.content);
        });
    }

    // ========== PREFIX COMMANDS ==========
    setupPrefixCommands() {
        this.client.on("messageCreate", async msg => {
            if (!msg.guild) return;
            if (msg.author.bot) return;

            const content = msg.content.toLowerCase();

            // ----------- PREFIX JOIN -----------
            if (content === "-join") {
                const member = msg.member;

                if (!member.voice.channel) {
                    const embed = this.buildStatusEmbed("not_in_channel", member, msg.guild);
                    if (embed) {
                        return msg.reply({ embeds: [embed] });
                    }
                    return msg.reply("❌ Devi essere in un canale vocale.");
                }

                const guildId = msg.guild.id;

                const connection = joinVoiceChannel({
                    channelId: member.voice.channel.id,
                    guildId,
                    adapterCreator: msg.guild.voiceAdapterCreator
                });

                const player = createAudioPlayer({
                    behaviors: { noSubscriber: NoSubscriberBehavior.Play }
                });

                connection.subscribe(player);

                this.connections.set(guildId, connection);
                this.players.set(guildId, player);

                player.on("stateChange", (oldState, newState) => {
                    if (newState.status === AudioPlayerStatus.Idle) {
                        const meta = oldState.resource?.metadata;
                        if (meta?.mp3) fs.unlink(meta.mp3, () => {});
                        if (meta?.wav) fs.unlink(meta.wav, () => {});
                        this.processQueue(guildId);
                    }
                });
                
                player.on("error", error => {
                    console.error("[TTS PLAYER ERROR]", error);
                
                    this.isPlaying.set(guildId, false);
                
                    // tenta di continuare la queue
                    setTimeout(() => {
                        this.processQueue(guildId);
                    }, 250);
                });

                this.botVoiceChannel.set(guildId, member.voice.channel.id);

                const embed = this.buildStatusEmbed("join", member, msg.guild, {
                    channel: member.voice.channel.name
                });

                if (embed) {
                    return msg.reply({ embeds: [embed] });
                }

                return msg.reply(`🔊 Entrato in **${member.voice.channel.name}**`);
            }

            // ----------- PREFIX LEAVE -----------
            if (content === "-leave") {
                const guildId = msg.guild.id;

                const conn = this.connections.get(guildId);
                if (!conn) {
                    const embed = this.buildStatusEmbed("no_voice", msg.member, msg.guild);
                    if (embed) {
                        return msg.reply({ embeds: [embed] });
                    }
                    return msg.reply("❌ Non sono in nessuna voice!");
                }

                const voiceChannelName = msg.guild.channels.cache.get(conn.joinConfig.channelId)?.name || "";
                conn.destroy();
                this.connections.delete(guildId);
                this.players.delete(guildId);
                this.botVoiceChannel.delete(guildId);

                const embed = this.buildStatusEmbed("leave", msg.member, msg.guild, {
                    channel: voiceChannelName
                });

                if (embed) {
                    return msg.reply({ embeds: [embed] });
                }

                return msg.reply("👋 Disconnesso.");
            }
        });
    }
}

function setup(client) {
    const cog = new TTSCog(client);
    cog.setupListeners();
    cog.setupPrefixCommands(); 

    client.on("interactionCreate", async interaction => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "tts") return;

        const sub = interaction.options.getSubcommand();

        if (sub === "setchannel") return cog.handleSetChannel(interaction);
        if (sub === "join") return cog.handleJoin(interaction);
        if (sub === "leave") return cog.handleLeave(interaction);
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.commands);

    return cog;
}

module.exports = { setup, TTSCog };
