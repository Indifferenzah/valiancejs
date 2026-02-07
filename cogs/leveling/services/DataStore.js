const { loadJsonSync, saveJsonSync } = require("../../../utils/jsonStore");

class DataStore {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.data = this.load();
  }

  load() {
    return loadJsonSync(this.dataPath, {});
  }

  save() {
    saveJsonSync(this.dataPath, this.data);
  }

  ensureEntry(guildId, userId) {
    if (!this.data[guildId]) this.data[guildId] = {};
    if (!this.data[guildId][userId]) {
      this.data[guildId][userId] = {
        xp: 0,
        level: 0,
        message_xp: 0,
        voice_xp: 0,
        voice_seconds: 0,
        lastMessageAt: 0,
        lastVoiceAt: 0,
      };
    }

    const entry = this.data[guildId][userId];
    if (entry.message_xp === undefined) entry.message_xp = 0;
    if (entry.voice_xp === undefined) entry.voice_xp = 0;
    if (entry.voice_seconds === undefined) entry.voice_seconds = 0;
    if (entry.lastMessageAt === undefined) entry.lastMessageAt = 0;
    if (entry.lastVoiceAt === undefined) entry.lastVoiceAt = 0;
    if (entry.level === undefined) entry.level = 0;
    if (entry.xp === undefined) entry.xp = 0;

    return entry;
  }

  getGuildData(guildId) {
    return this.data[guildId] || {};
  }
}

module.exports = DataStore;
