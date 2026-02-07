class VoiceXpHandler {
  constructor(configManager, xpService, logger) {
    this.configManager = configManager;
    this.xpService = xpService;
    this.logger = logger;
    this.sessions = new Map();
  }

  getSessionKey(guildId, userId) {
    return `${guildId}:${userId}`;
  }

  shouldTrack(member, channelId) {
    if (!member || member.user?.bot) return false;
    if (!this.configManager.isEnabled()) return false;

    const ignoredRoles = this.configManager.getIgnoredRoles();
    if (
      member.roles?.cache &&
      Array.isArray(ignoredRoles) &&
      ignoredRoles.length > 0
    ) {
      if (member.roles.cache.some((r) => ignoredRoles.includes(r.id)))
        return false;
    }

    const ignoredVoice = this.configManager.getVoiceIgnoredChannels();
    if (Array.isArray(ignoredVoice) && ignoredVoice.includes(channelId))
      return false;

    return true;
  }

  startSession(member, channelId) {
    if (!this.shouldTrack(member, channelId)) return;
    const key = this.getSessionKey(member.guild.id, member.id);
    if (this.sessions.has(key)) return;
    const now = Date.now();
    this.sessions.set(key, { joinedAt: now, lastAwardAt: now, channelId });
  }

  async endSession(member) {
    const key = this.getSessionKey(member.guild.id, member.id);
    const session = this.sessions.get(key);
    if (!session) return;

    this.sessions.delete(key);

    const seconds = Math.floor((Date.now() - session.lastAwardAt) / 1000);
    if (seconds <= 0) return;

    await this.xpService.awardVoiceXp(member, seconds);
  }

  startExistingSessions(client) {
    for (const guild of client.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        if (!channel.isVoiceBased?.() || !channel.members) continue;
        for (const member of channel.members.values()) {
          this.startSession(member, channel.id);
        }
      }
    }
  }

  async tick(client) {
    const now = Date.now();
    const cfg = this.configManager.getVoiceXpConfig();
    const minSeconds = Math.max(1, cfg.minSeconds);

    for (const [key, session] of this.sessions.entries()) {
      const [guildId, userId] = key.split(":");
      const guild = client.guilds.cache.get(guildId);
      const member = guild?.members?.cache?.get(userId) || null;

      if (!member || !member.voice?.channelId) {
        this.sessions.delete(key);
        continue;
      }

      if (member.voice.channelId !== session.channelId) {
        this.sessions.delete(key);
        continue;
      }

      const elapsedSeconds = Math.floor((now - session.lastAwardAt) / 1000);
      if (elapsedSeconds < minSeconds) continue;

      await this.xpService.awardVoiceXp(member, elapsedSeconds);
      session.lastAwardAt = now;
    }
  }

  async handle(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user?.bot) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (oldChannelId === newChannelId) return;

    if (oldChannelId && !newChannelId) {
      if (this.shouldTrack(member, oldChannelId)) {
        await this.endSession(member);
      } else {
        this.sessions.delete(this.getSessionKey(member.guild.id, member.id));
      }
      return;
    }

    if (!oldChannelId && newChannelId) {
      this.startSession(member, newChannelId);
      return;
    }

    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      if (this.shouldTrack(member, oldChannelId)) {
        await this.endSession(member);
      } else {
        this.sessions.delete(this.getSessionKey(member.guild.id, member.id));
      }
      this.startSession(member, newChannelId);
    }
  }
}

module.exports = VoiceXpHandler;
