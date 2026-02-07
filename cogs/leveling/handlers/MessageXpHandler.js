class MessageXpHandler {
  constructor(configManager, xpService) {
    this.configManager = configManager;
    this.xpService = xpService;
    this.cooldowns = new Map();
  }

  canGainXp(message) {
    if (!message.guild || message.author.bot) return false;
    if (!this.configManager.isEnabled()) return false;

    if (this.configManager.getIgnoredChannels()?.includes(message.channelId)) {
      return false;
    }

    const member = message.member;
    const ignoredRoles = this.configManager.getIgnoredRoles();
    if (member && Array.isArray(ignoredRoles) && ignoredRoles.length > 0) {
      if (member.roles.cache.some((r) => ignoredRoles.includes(r.id)))
        return false;
    }

    const key = `${message.guildId}:${message.author.id}`;
    const now = Date.now();
    const cooldownMs = this.configManager.getCooldownSeconds() * 1000;
    const last = this.cooldowns.get(key) || 0;

    if (cooldownMs > 0 && now - last < cooldownMs) return false;
    this.cooldowns.set(key, now);
    return true;
  }

  async handle(message) {
    if (!this.canGainXp(message)) return;
    await this.xpService.awardMessageXp(message);
  }
}

module.exports = MessageXpHandler;
