const { loadJsonSync, saveJsonSync } = require("../../../utils/jsonStore");

class ConfigManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = this.load();
  }

  load() {
    return loadJsonSync(this.configPath, {
      enabled: true,
      xp_min: 8,
      xp_max: 15,
      cooldown_seconds: 45,
      ignored_channel_ids: [],
      ignored_role_ids: [],
      announce_channel_id: null,
      level_base_xp: 100,
      role_levels: {},
      message_xp_min: null,
      message_xp_max: null,
      message_xp_per_char: 0.05,
      message_xp_char_cap: 200,
      message_xp_max_total: 50,
      voice_xp_per_min: 3,
      voice_min_seconds: 30,
      voice_ignored_channel_ids: [],
    });
  }

  save() {
    saveJsonSync(this.configPath, this.config);
  }

  reload() {
    this.config = this.load();
  }

  get(key, fallback) {
    const parts = String(key || "").split(".");
    let value = this.config;
    for (const part of parts) {
      if (!value || typeof value !== "object" || !(part in value)) {
        return fallback;
      }
      value = value[part];
    }
    return value === undefined ? fallback : value;
  }

  isEnabled() {
    return this.get("enabled", true);
  }

  getCooldownSeconds() {
    return Math.max(0, Number(this.get("cooldown_seconds", 45)));
  }

  getMessageXpConfig() {
    const minFallback = Number(this.get("xp_min", 8));
    const maxFallback = Number(this.get("xp_max", 15));

    const min = Number(this.get("message_xp_min", minFallback));
    const max = Number(this.get("message_xp_max", maxFallback));
    const perChar = Number(this.get("message_xp_per_char", 0.05));
    const charCap = Math.max(0, Number(this.get("message_xp_char_cap", 200)));
    const maxTotal = Math.max(0, Number(this.get("message_xp_max_total", 50)));

    return {
      min: Number.isFinite(min) ? Math.max(0, min) : 0,
      max: Number.isFinite(max) ? Math.max(0, max) : 0,
      perChar: Number.isFinite(perChar) ? Math.max(0, perChar) : 0,
      charCap,
      maxTotal,
    };
  }

  getVoiceXpConfig() {
    const perMin = Number(this.get("voice_xp_per_min", 3));
    const minSeconds = Math.max(0, Number(this.get("voice_min_seconds", 30)));
    const perSecond = perMin / 60;

    return {
      perSecond: Number.isFinite(perSecond) ? Math.max(0, perSecond) : 0,
      minSeconds,
    };
  }

  getIgnoredChannels() {
    return this.get("ignored_channel_ids", []);
  }

  getIgnoredRoles() {
    return this.get("ignored_role_ids", []);
  }

  getVoiceIgnoredChannels() {
    return this.get("voice_ignored_channel_ids", []);
  }

  getAnnounceChannelId() {
    return this.get("announce_channel_id", null);
  }

  getLevelBaseXp() {
    return Math.max(1, Number(this.get("level_base_xp", 100)));
  }

  getRoleLevels() {
    return this.get("role_levels", {});
  }
}

module.exports = ConfigManager;
