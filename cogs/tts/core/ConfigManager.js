const { loadJsonSync, saveJsonSync } = require("../../../utils/jsonStore");

class ConfigManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = this.load();
  }

  load() {
    return loadJsonSync(this.configPath, {
      channel: null,
      language: "it",
      volume: 1,
      default_voice: "it-IT-ElsaNeural",
      default_volume: 50,
      user_settings: {},
    });
  }

  save() {
    saveJsonSync(this.configPath, this.config);
  }

  reload() {
    this.config = this.load();
  }

  getChannel() {
    return this.config.channel || null;
  }

  setChannel(channelId) {
    this.config.channel = channelId;
    this.save();
  }

  getLanguage() {
    if (
      typeof this.config.language === "string" &&
      this.config.language.trim()
    ) {
      return this.config.language.trim();
    }

    if (typeof this.config.default_voice === "string") {
      const match = this.config.default_voice.match(/^([a-z]{2})/i);
      if (match) {
        return match[1].toLowerCase();
      }
    }

    return "it";
  }

  getVolume() {
    if (typeof this.config.volume === "number") {
      return this.normalizeVolume(this.config.volume);
    }

    if (typeof this.config.default_volume === "number") {
      return this.normalizeVolume(this.config.default_volume / 100);
    }

    return 1;
  }

  normalizeVolume(value) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return 1;
    if (numeric > 1) {
      return Math.min(numeric / 100, 1);
    }
    return Math.max(Math.min(numeric, 1), 0);
  }
}

module.exports = ConfigManager;
