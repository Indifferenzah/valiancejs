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

    async handleSetChannel(interaction) {
        if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
            return interaction.reply({ content: "? Non hai i permessi per impostare il canale TTS.", ephemeral: true });
        }

        const channel = interaction.options.getChannel("channel");

        if (!channel.isTextBased()) {
            return interaction.reply({
                content: "? Devi selezionare un canale testuale!",
                ephemeral: true
            });
        }

        this.config.channel = channel.id;
        this.saveConfig();

        return interaction.reply({
            content: `? Canale TTS impostato su <#${channel.id}>`,
            ephemeral: true
        });
    }

    async handleJoin(interaction) {
        const member = interaction.member;

        if (!member.voice.channel) {
            return interaction.reply({
                content: "❌ Devi essere in un canale vocale!",
                flags: ["Ephemeral"]
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

        // Salva in quale voice è il bot
        this.botVoiceChannel.set(guildId, member.voice.channel.id);

        return interaction.reply({
            content: `🔊 Entrato in **${member.voice.channel.name}**`,
            flags: ["Ephemeral"]
        });
    }

    async handleLeave(interaction) {
        const guildId = interaction.guild.id;

        const conn = this.connections.get(guildId);
        if (!conn) {
            return interaction.reply({
                content: "❌ Non sono in nessuna voice!",
                flags: ["Ephemeral"]
            });
        }

        conn.destroy();
        this.connections.delete(guildId);
        this.players.delete(guildId);
        this.botVoiceChannel.delete(guildId);

        return interaction.reply({
            content: "👋 Disconnesso dalla voice.",
            flags: ["Ephemeral"]
        });
    }

    async playTTS(guildId, text) {
        const conn = this.connections.get(guildId);
        const player = this.players.get(guildId);

        if (!conn || !player) return;

        const mp3 = await this.generateMP3(text);
        const wav = await this.convertToPCM(mp3);

        const resource = createAudioResource(wav);
        player.play(resource);
    }

    setupListeners() {
        this.client.on("messageCreate", async msg => {
            if (!msg.guild) return;
            if (msg.author.bot) return;

            const guildId = msg.guild.id;
            const botVC = this.botVoiceChannel.get(guildId);

            // Se il bot NON è in VC → ignora
            if (!botVC) return;

            const userVC = msg.member.voice?.channel?.id;

            // L’utente deve essere nella STESSA VC del bot
            if (userVC !== botVC) return;

            const allowedChannels = [
                this.config.channel,
                msg.guild.channels.cache.get(botVC)?.guild.voiceStates.cache.get(this.client.user.id)?.channel?.id
            ];

            // Chat della VC
            const voiceTextChannel = msg.guild.channels.cache.find(
                c => c.isTextBased() && c.parentId === botVC
            );

            if (
                msg.channel.id !== this.config.channel &&
                (!voiceTextChannel || msg.channel.id !== voiceTextChannel.id)
            ) {
                return;
            }

            await this.playTTS(guildId, msg.content);
        });
    }
}

function setup(client) {
    const cog = new TTSCog(client);
    cog.setupListeners();

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
