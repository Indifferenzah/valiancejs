class MessageHandler {
  constructor({
    configManager,
    blacklistService,
    voiceSessionService,
    logger,
  }) {
    this.configManager = configManager;
    this.blacklistService = blacklistService;
    this.voiceSessionService = voiceSessionService;
    this.logger = logger;
  }

  isAllowedTtsChannel(channelId, voiceChannelId) {
    const configured = this.configManager.getChannel();
    if (configured && channelId === configured) return true;
    if (voiceChannelId && channelId === voiceChannelId) return true;
    return false;
  }

  handleMessage(message) {
    if (!message.guild) return;
    if (message.author?.bot) return;

    if (this.blacklistService.isBlacklisted(message.author.id)) return;

    const guildId = message.guild.id;
    if (!this.voiceSessionService.isConnected(guildId)) return;

    const botVoiceId = this.voiceSessionService.getBotVoiceChannelId(guildId);
    const memberVoiceId = message.member?.voice?.channelId;
    if (!botVoiceId || memberVoiceId !== botVoiceId) return;

    if (!this.isAllowedTtsChannel(message.channel.id, botVoiceId)) return;

    const content = message.content?.trim();
    if (!content) return;

    this.voiceSessionService.enqueue(guildId, content);
  }
}

module.exports = MessageHandler;
