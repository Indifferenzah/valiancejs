const fs = require("fs");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  StreamType,
} = require("@discordjs/voice");

class VoiceSessionService {
  constructor(ttsService, configManager, logger) {
    this.ttsService = ttsService;
    this.configManager = configManager;
    this.logger = logger;

    this.connections = new Map();
    this.players = new Map();
    this.botVoiceChannel = new Map();
    this.queue = new Map();
    this.isProcessing = new Map();
  }

  getBotVoiceChannelId(guildId) {
    return this.botVoiceChannel.get(guildId) || null;
  }

  isConnected(guildId) {
    return this.connections.has(guildId) && this.players.has(guildId);
  }

  join(voiceChannel) {
    const guildId = voiceChannel.guild.id;
    const currentChannelId = this.botVoiceChannel.get(guildId);

    if (currentChannelId && currentChannelId !== voiceChannel.id) {
      this.leave(guildId);
    }

    if (!this.connections.has(guildId)) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play },
      });

      connection.subscribe(player);

      this.connections.set(guildId, connection);
      this.players.set(guildId, player);
      this.botVoiceChannel.set(guildId, voiceChannel.id);

      this.attachPlayerEvents(guildId, player);
    }

    return {
      channelId: voiceChannel.id,
    };
  }

  leave(guildId) {
    const connection = this.connections.get(guildId);
    if (!connection) {
      return { hadConnection: false, channelId: null };
    }

    connection.destroy();
    this.connections.delete(guildId);
    this.players.delete(guildId);
    const channelId = this.botVoiceChannel.get(guildId) || null;
    this.botVoiceChannel.delete(guildId);
    this.queue.delete(guildId);
    this.isProcessing.delete(guildId);

    return { hadConnection: true, channelId };
  }

  enqueue(guildId, text) {
    if (!this.players.has(guildId) || !this.connections.has(guildId)) {
      return false;
    }

    const normalized = text?.trim();
    if (!normalized) return false;

    if (!this.queue.has(guildId)) {
      this.queue.set(guildId, []);
    }

    this.queue.get(guildId).push(normalized);
    this.playNext(guildId);
    return true;
  }

  async playNext(guildId) {
    if (this.isProcessing.get(guildId)) return;

    const player = this.players.get(guildId);
    const queue = this.queue.get(guildId);

    if (!player || !queue || queue.length === 0) return;
    if (player.state.status !== AudioPlayerStatus.Idle) return;

    const text = queue.shift();
    this.isProcessing.set(guildId, true);

    try {
      const audio = await this.ttsService.synthesize(text, guildId);
      const resource = createAudioResource(audio.oggPath, {
        inputType: StreamType.OggOpus,
        inlineVolume: true,
        metadata: audio,
      });

      const volume = this.configManager.getVolume();
      if (resource.volume && typeof volume === "number") {
        resource.volume.setVolume(volume);
      }

      player.play(resource);
    } catch (error) {
      this.logger?.error?.(`[TTS] Errore generazione audio: ${error.message}`);
      this.isProcessing.set(guildId, false);
      setTimeout(() => this.playNext(guildId), 200);
    }
  }

  attachPlayerEvents(guildId, player) {
    player.on("stateChange", (oldState, newState) => {
      if (
        newState.status === AudioPlayerStatus.Idle &&
        oldState.status !== AudioPlayerStatus.Idle
      ) {
        const meta = oldState.resource?.metadata;
        if (meta?.mp3Path || meta?.oggPath) {
          this.cleanupFiles([meta.mp3Path, meta.oggPath]);
        }
        this.isProcessing.set(guildId, false);
        this.playNext(guildId);
      }
    });

    player.on("error", (error) => {
      this.logger?.error?.(`[TTS] Player error: ${error.message}`);
      const meta = player.state?.resource?.metadata;
      if (meta?.mp3Path || meta?.oggPath) {
        this.cleanupFiles([meta.mp3Path, meta.oggPath]);
      }
      this.isProcessing.set(guildId, false);
      setTimeout(() => this.playNext(guildId), 200);
    });
  }

  cleanupFiles(files) {
    for (const filePath of files || []) {
      if (!filePath) continue;
      fs.unlink(filePath, (error) => {
        if (error && error.code !== "ENOENT") {
          this.logger?.debug?.(`[TTS] Cleanup failed: ${filePath}`);
        }
      });
    }
  }
}

module.exports = VoiceSessionService;
