const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { ownerOrHasPermissions } = require("../../../utils/botUtils");

class CommandHandler {
  constructor({
    configManager,
    blacklistService,
    voiceSessionService,
    embedFactory,
    logger,
  }) {
    this.configManager = configManager;
    this.blacklistService = blacklistService;
    this.voiceSessionService = voiceSessionService;
    this.embedFactory = embedFactory;
    this.logger = logger;
  }

  getCommands() {
    return [
      new SlashCommandBuilder()
        .setName("tts")
        .setDescription("Sistema TTS professionale")
        .addSubcommand((sub) =>
          sub
            .setName("setchannel")
            .setDescription("Imposta il canale da cui leggere il TTS")
            .addChannelOption((opt) =>
              opt
                .setName("channel")
                .setDescription("Canale testuale")
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub.setName("join").setDescription("Il bot entra nella tua vocale"),
        )
        .addSubcommand((sub) =>
          sub.setName("leave").setDescription("Il bot lascia la vocale"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("blacklist")
            .setDescription("Aggiungi/rimuovi un utente dalla blacklist TTS")
            .addUserOption((opt) =>
              opt
                .setName("user")
                .setDescription("Utente da blacklistare/rimuovere")
                .setRequired(true),
            ),
        ),
    ];
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "tts") return;

    const sub = interaction.options.getSubcommand();

    if (sub === "setchannel") return this.handleSetChannel(interaction);
    if (sub === "join") return this.handleJoin(interaction);
    if (sub === "leave") return this.handleLeave(interaction);
    if (sub === "blacklist") return this.handleBlacklist(interaction);
  }

  isAllowedCommandChannel(channelId, voiceChannelId) {
    const configured = this.configManager.getChannel();
    if (configured && channelId === configured) return true;
    if (voiceChannelId && channelId === voiceChannelId) return true;
    return false;
  }

  async handleSetChannel(interaction) {
    if (
      !ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)
    ) {
      return interaction.reply({
        content: "❌ Non hai i permessi.",
        ephemeral: true,
      });
    }

    const channel = interaction.options.getChannel("channel");
    if (!channel.isTextBased()) {
      return interaction.reply({
        content: "❌ Devi selezionare un canale testuale!",
        ephemeral: true,
      });
    }

    this.configManager.setChannel(channel.id);

    return interaction.reply({
      content: `✔ Canale TTS impostato su <#${channel.id}>`,
      ephemeral: true,
    });
  }

  async handleJoin(interaction) {
    const member = interaction.member;
    const voiceChannel = member?.voice?.channel;

    if (
      !this.isAllowedCommandChannel(interaction.channelId, voiceChannel?.id)
    ) {
      return interaction.reply({
        content:
          "❌ Usa questo comando nel canale TTS o nella chat della vocale.",
        ephemeral: true,
      });
    }

    if (!voiceChannel) {
      const embed = this.embedFactory.build(
        "not_in_channel",
        member,
        interaction.guild,
      );
      if (embed) {
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      return interaction.reply({
        content: "❌ Devi essere in un canale vocale!",
        ephemeral: true,
      });
    }

    this.voiceSessionService.join(voiceChannel);

    const embed = this.embedFactory.build("join", member, interaction.guild, {
      channel: voiceChannel.name,
    });

    if (embed) {
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    return interaction.reply({
      content: `🔊 Entrato in **${voiceChannel.name}**`,
      ephemeral: true,
    });
  }

  async handleLeave(interaction) {
    const member = interaction.member;
    const voiceChannel = member?.voice?.channel;

    if (
      !this.isAllowedCommandChannel(interaction.channelId, voiceChannel?.id)
    ) {
      return interaction.reply({
        content:
          "❌ Usa questo comando nel canale TTS o nella chat della vocale.",
        ephemeral: true,
      });
    }

    const guildId = interaction.guild.id;
    const leaveResult = this.voiceSessionService.leave(guildId);

    if (!leaveResult.hadConnection) {
      const embed = this.embedFactory.build(
        "no_voice",
        member,
        interaction.guild,
      );
      if (embed) {
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      return interaction.reply({
        content: "❌ Non sono in nessuna voice!",
        ephemeral: true,
      });
    }

    const channelName =
      interaction.guild.channels.cache.get(leaveResult.channelId)?.name || "";
    const embed = this.embedFactory.build("leave", member, interaction.guild, {
      channel: channelName,
    });

    if (embed) {
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    return interaction.reply({
      content: "👋 Disconnesso.",
      ephemeral: true,
    });
  }

  async handleBlacklist(interaction) {
    if (
      !ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)
    ) {
      return interaction.reply({
        content: "❌ Non hai i permessi.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("user");
    const added = this.blacklistService.toggle(user.id);

    return interaction.reply({
      content: added
        ? `✅ **${user.tag}** è stato aggiunto alla blacklist TTS. I suoi messaggi non verranno più letti.`
        : `✅ **${user.tag}** è stato rimosso dalla blacklist TTS.`,
      ephemeral: true,
    });
  }
}

module.exports = CommandHandler;
