// Assuming the original content is updated with the fixes provided in the code snippets.
const fs = require('fs');
const {createAudioResource, AudioPlayerStatus} = require('discord.js');
const {joinVoiceChannel} = require('@discordjs/voice');

class TTS {
    constructor() {
        this.queue = new Map();
        this.players = new Map();
        this.isPlaying = new Map();
        this.connections = new Map();
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
                metadata: { mp3, wav },
            });

            player.play(resource);

            // Ensure queue continues processing when an item finishes
            player.once(AudioPlayerStatus.Idle, () => {
                if (resource.metadata?.mp3) fs.unlink(resource.metadata.mp3, () => {});
                if (resource.metadata?.wav) fs.unlink(resource.metadata.wav, () => {});
                this.processQueue(guildId);
            });
        } catch (err) {
            console.error("[TTS Queue Error]", err);
            // Safeguard to retry processing
            setTimeout(() => this.processQueue(guildId), 1000);
        }
    }

    handleJoin(interaction) {
        const guildId = interaction.guild.id;
        const member = interaction.member;

        if (!member.voice.channel) return;

        const connection = joinVoiceChannel({
            channelId: member.voice.channel.id,
            guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator
        });

        // Ensure resilience to voice connection drops
        connection.on("stateChange", (oldState, newState) => {
            if (newState.status === "disconnected") {
                console.log("Connection to voice channel lost. Reconnecting...");
                connection.destroy();
                this.connections.delete(guildId);
                this.players.delete(guildId);
                this.handleJoin(interaction); // Attempt reconnection
            }
        });
    }

    generateMP3(text, guildId) {
        // Mock function to generate MP3 from text
    }

    convertToPCM(mp3) {
        // Mock function to convert MP3 to WAV
    }
}

module.exports = TTS;