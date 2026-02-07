const { EmbedBuilder } = require("discord.js");
const LevelMath = require("../core/LevelMath");

class XpService {
  constructor(configManager, dataStore, rewardService, logger) {
    this.configManager = configManager;
    this.dataStore = dataStore;
    this.rewardService = rewardService;
    this.logger = logger;
    this.levelMath = new LevelMath(this.configManager.getLevelBaseXp());
  }

  refreshMath() {
    this.levelMath = new LevelMath(this.configManager.getLevelBaseXp());
  }

  computeMessageXp(content) {
    const cfg = this.configManager.getMessageXpConfig();
    const min = Math.max(0, cfg.min);
    const max = Math.max(min, cfg.max);
    const base = Math.floor(Math.random() * (max - min + 1)) + min;

    const length = typeof content === "string" ? content.length : 0;
    const charCount = cfg.charCap > 0 ? Math.min(length, cfg.charCap) : length;
    const charBonus = Math.floor(charCount * cfg.perChar);

    const total = base + charBonus;
    if (cfg.maxTotal > 0) return Math.min(total, cfg.maxTotal);
    return total;
  }

  computeVoiceXp(seconds) {
    const cfg = this.configManager.getVoiceXpConfig();
    if (seconds < cfg.minSeconds) return 0;
    return Math.floor(seconds * cfg.perSecond);
  }

  addXp(guildId, userId, amount, meta = {}) {
    const entry = this.dataStore.ensureEntry(guildId, userId);
    const beforeLevel = entry.level;

    entry.xp = Math.max(0, Number(entry.xp || 0) + amount);
    entry.level = this.levelMath.levelFromXp(entry.xp);

    if (meta.type === "message") {
      entry.message_xp = Math.max(0, Number(entry.message_xp || 0) + amount);
      entry.lastMessageAt = Date.now();
    }

    if (meta.type === "voice") {
      entry.voice_xp = Math.max(0, Number(entry.voice_xp || 0) + amount);
      entry.voice_seconds = Math.max(
        0,
        Number(entry.voice_seconds || 0) + (meta.seconds || 0),
      );
      entry.lastVoiceAt = Date.now();
    }

    this.dataStore.save();

    return {
      entry,
      beforeLevel,
      leveledUp: entry.level > beforeLevel,
    };
  }

  async announceLevelUp(guild, member, entry) {
    const channelId = this.configManager.getAnnounceChannelId();
    if (!channelId || !guild) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return;

    const nextXp = this.levelMath.xpForLevel(entry.level + 1);

    const embed = new EmbedBuilder()
      .setTitle("⬆️ Level Up!")
      .setDescription(`${member} e' salito al **livello ${entry.level}**!`)
      .addFields(
        { name: "XP Totali", value: `${entry.xp}`, inline: true },
        {
          name: "XP per prossimo",
          value: `${Math.max(0, nextXp - entry.xp)}`,
          inline: true,
        },
      );

    await channel
      .send({ content: `${member}`, embeds: [embed] })
      .catch(() => {});
  }

  async awardMessageXp(message) {
    const gained = this.computeMessageXp(message.content);
    if (gained <= 0) return { gained: 0, leveledUp: false };

    const result = this.addXp(message.guildId, message.author.id, gained, {
      type: "message",
    });

    if (result.leveledUp) {
      await this.rewardService.applyRoleRewards(
        message.guild,
        message.member,
        result.entry.level,
      );
      await this.announceLevelUp(message.guild, message.member, result.entry);
      this.logger?.info?.(
        `[leveling] Level up: guild=${message.guildId} user=${message.author.id} ${result.beforeLevel} -> ${result.entry.level}`,
      );
    }

    return { gained, leveledUp: result.leveledUp };
  }

  async awardVoiceXp(member, seconds) {
    const gained = this.computeVoiceXp(seconds);
    if (gained <= 0) return { gained: 0, leveledUp: false };

    const result = this.addXp(member.guild.id, member.id, gained, {
      type: "voice",
      seconds,
    });

    if (result.leveledUp) {
      await this.rewardService.applyRoleRewards(
        member.guild,
        member,
        result.entry.level,
      );
      await this.announceLevelUp(member.guild, member, result.entry);
      this.logger?.info?.(
        `[leveling] Level up: guild=${member.guild.id} user=${member.id} ${result.beforeLevel} -> ${result.entry.level}`,
      );
    }

    return { gained, leveledUp: result.leveledUp };
  }
}

module.exports = XpService;
