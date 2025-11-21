const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior
} = require("@discordjs/voice");

const { loadJsonSync, saveJsonSync } = require("../../utils/jsonStore");
const { ownerOrHasPermissions } = require("../../utils/botUtils");

const fs = require("fs");
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

    async generateMP3(text) {
        return new Promise((resolve, reject) => {
            const out = path.join(__dirname, "tts.mp3");
            const tts = new gTTS(text, "it");

            tts.save(out, (err) => {
                if (err) reject(err);
                else resolve(out);
            });
        });
    }

    async convertToPCM(mp3File) {
        return new Promise((resolve, reject) => {
            const out = path.join(__dirname, "tts.wav");

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

    // ========== QUEUE SYSTEM ==========

    async enqueueTTS(guildId, text) {
        if (!this.queue.has(guildId)) this.queue.set(guildId, []);
        this.queue.get(guildId).push(text);

        if (!this.isPlaying.get(guildId)) {
            this.isPlaying.set(guildId, true);
            this.processQueue(guildId);
        }
    }

    async processQueue(guildId) {
        const queue = this.queue.get(guildId);
        const conn = this.connections.get(guildId);
        const player = this.players.get(guildId);

        if (!queue || queue.length === 0) {
            this.isPlaying.set(guildId, false);
            return;
        }

        const text = queue.shift();

        const mp3 = await this.generateMP3(text);
        const wav = await this.convertToPCM(mp3);

        const resource = createAudioResource(wav);

        player.once("idle", () => {
            this.processQueue(guildId);
        });

        player.play(resource);
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
            behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
        });

        connection.subscribe(player);

        this.connections.set(guildId, connection);
        this.players.set(guildId, player);

        this.botVoiceChannel.set(guildId, member.voice.channel.id);

        return interaction.reply({
            content: `🔊 Entrato in **${member.voice.channel.name}**`,
            ephemeral: true
        });
    }

    async handleLeave(interaction) {
        const guildId = interaction.guild.id;

        const conn = this.connections.get(guildId);
        if (!conn) {
            return interaction.reply({
                content: "❌ Non sono in nessuna voice!",
                ephemeral: true
            });
        }

        conn.destroy();
        this.connections.delete(guildId);
        this.players.delete(guildId);
        this.botVoiceChannel.delete(guildId);

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
                    return msg.reply("❌ Devi essere in un canale vocale.");
                }

                const guildId = msg.guild.id;

                const connection = joinVoiceChannel({
                    channelId: member.voice.channel.id,
                    guildId,
                    adapterCreator: msg.guild.voiceAdapterCreator
                });

                const player = createAudioPlayer({
                    behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
                });

                connection.subscribe(player);

                this.connections.set(guildId, connection);
                this.players.set(guildId, player);

                this.botVoiceChannel.set(guildId, member.voice.channel.id);

                return msg.reply(`🔊 Entrato in **${member.voice.channel.name}**`);
            }

            // ----------- PREFIX LEAVE -----------
            if (content === "-leave") {
                const guildId = msg.guild.id;

                const conn = this.connections.get(guildId);
                if (!conn) {
                    return msg.reply("❌ Non sono in nessuna voice!");
                }

                conn.destroy();
                this.connections.delete(guildId);
                this.players.delete(guildId);
                this.botVoiceChannel.delete(guildId);

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
