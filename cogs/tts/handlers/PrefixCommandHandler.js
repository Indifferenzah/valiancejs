class PrefixCommandHandler {
  constructor({ configManager, voiceSessionService, embedFactory, logger }) {
    this.configManager = configManager;
    this.voiceSessionService = voiceSessionService;
    this.embedFactory = embedFactory;
    this.logger = logger;
  }

  isAllowedCommandChannel(channelId, voiceChannelId) {
    const configured = this.configManager.getChannel();
    if (configured && channelId === configured) return true;
    if (voiceChannelId && channelId === voiceChannelId) return true;
    return false;
  }

  async handleMessage(message) {
    if (!message.guild) return;
    if (message.author?.bot) return;

    const content = message.content?.trim().toLowerCase();
    if (!content) return;

    if (content !== "-join" && content !== "-leave") return;

    const member = message.member;
    const voiceChannel = member?.voice?.channel;

    if (!this.isAllowedCommandChannel(message.channel.id, voiceChannel?.id)) {
      return message.reply(
        "❌ Usa questo comando nel canale TTS o nella chat della vocale.",
      );
    }

    if (content === "-join") {
      if (!voiceChannel) {
        const embed = this.embedFactory.build(
          "not_in_channel",
          member,
          message.guild,
        );
        if (embed) {
          return message.reply({ embeds: [embed] });
        }
        return message.reply("❌ Devi essere in un canale vocale.");
      }

      this.voiceSessionService.join(voiceChannel);

      const embed = this.embedFactory.build("join", member, message.guild, {
        channel: voiceChannel.name,
      });

      if (embed) {
        return message.reply({ embeds: [embed] });
      }

      return message.reply(`🔊 Entrato in **${voiceChannel.name}**`);
    }

    if (content === "-leave") {
      const guildId = message.guild.id;
      const leaveResult = this.voiceSessionService.leave(guildId);

      if (!leaveResult.hadConnection) {
        const embed = this.embedFactory.build(
          "no_voice",
          member,
          message.guild,
        );
        if (embed) {
          return message.reply({ embeds: [embed] });
        }
        return message.reply("❌ Non sono in nessuna voice!");
      }

      const channelName =
        message.guild.channels.cache.get(leaveResult.channelId)?.name || "";
      const embed = this.embedFactory.build("leave", member, message.guild, {
        channel: channelName,
      });

      if (embed) {
        return message.reply({ embeds: [embed] });
      }

      return message.reply("👋 Disconnesso.");
    }
  }
}

module.exports = PrefixCommandHandler;
