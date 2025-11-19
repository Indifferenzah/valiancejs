const {
    SlashCommandBuilder
} = require("discord.js");

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior
} = require("@discordjs/voice");

const { loadJsonSync, saveJsonSync } = require("../../utils/jsonStore");

const fs = require("fs");
const path = require("path");
const gTTS = require("gtts");

class TTSCog {
    constructor(client) {
        this.client = client;

        this.configPath = path.join(__dirname, "tts.json");
        this.config = loadJsonSync(this.configPath, {
            channel: null
        });

        this.connections = new Map();
        this.players = new Map();

        this.commands = [
            new SlashCommandBuilder()
                .setName("tts")
                .setDescription("Sistema TTS offline gTTS")
                .addSubcommand(sub =>
                    sub.setName("say")
                        .setDescription("Text-to-Speech nel canale vocale")
                        .addStringOption(opt =>
                            opt.setName("text")
                                .setDescription("Testo da pronunciare")
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName("voice")
                        .setDescription("Seleziona la voce TTS (placeholder)")
                        .addStringOption(opt =>
                            opt.setName("voice")
                                .setDescription("Nome della voce")
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName("volume")
                        .setDescription("Imposta il volume del TTS (placeholder)")
                        .addIntegerOption(opt =>
                            opt.setName("volume")
                                .setDescription("Volume (0-100)")
                                .setRequired(true)
                                .setMinValue(0)
                                .setMaxValue(100)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName("stop")
                        .setDescription("Ferma il TTS e svuota la coda")
                )
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

    /**
     * Usa gTTS per generare un mp3
     */
    async generateTTS(text) {
        return new Promise((resolve, reject) => {
            const out = path.join(__dirname, "tts.mp3");
            const tts = new gTTS(text, "it");

            tts.save(out, (err) => {
                if (err) reject(err);
                else resolve(out);
            });
        });
    }

    async handleSetChannel(interaction) {
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
            content: `✅ Canale TTS impostato su <#${channel.id}>`,
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

        return interaction.reply({
            content: "👋 Disconnesso dalla voice.",
            ephemeral: true
        });
    }

    async playTTS(guildId, text) {
        const conn = this.connections.get(guildId);
        const player = this.players.get(guildId);

        if (!conn || !player) return;

        try {
            // genera mp3 con gTTS
            const mp3File = await this.generateTTS(text);
            const resource = createAudioResource(mp3File);
            player.play(resource);
        } catch (error) {
            console.error("Error playing TTS:", error);
        }
    }

    async handleSay(interaction) {
        const text = interaction.options.getString("text");
        const member = interaction.member;

        if (!member.voice.channel) {
            return interaction.reply({
                content: "❌ Devi essere in un canale vocale!",
                ephemeral: true
            });
        }

        const guildId = interaction.guild.id;

        // Auto join if not connected
        if (!this.connections.get(guildId)) {
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
        }

        await interaction.reply({
            content: "🔊 Sto parlando...",
            ephemeral: true
        });

        await this.playTTS(guildId, text);
    }

    async handleVoice(interaction) {
        const voice = interaction.options.getString("voice");
        await interaction.reply({
            content: `✅ Voce impostata su ${voice} (placeholder - gTTS usa sempre italiano)`,
            ephemeral: true
        });
    }

    async handleVolume(interaction) {
        const volume = interaction.options.getInteger("volume");
        await interaction.reply({
            content: "||Coming Soon...|| Volume TTS non ancora implementato",
            ephemeral: true
        });
    }

    async handleStop(interaction) {
        const guildId = interaction.guild.id;
        const player = this.players.get(guildId);

        if (player) {
            player.stop();
        }

        await interaction.reply({
            content: "⏹️ TTS fermato.",
            ephemeral: true
        });
    }

    setupListeners() {
        this.client.on("messageCreate", async msg => {
            if (!this.config.channel) return;
            if (msg.channel.id !== this.config.channel) return;
            if (msg.author.bot) return;

            const guildId = msg.guild.id;

            if (!this.connections.get(guildId)) return;

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

        if (sub === "say") return cog.handleSay(interaction);
        if (sub === "voice") return cog.handleVoice(interaction);
        if (sub === "volume") return cog.handleVolume(interaction);
        if (sub === "stop") return cog.handleStop(interaction);
        if (sub === "setchannel") return cog.handleSetChannel(interaction);
        if (sub === "join") return cog.handleJoin(interaction);
        if (sub === "leave") return cog.handleLeave(interaction);
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.commands);

    return cog;
}

module.exports = { setup, TTSCog };
