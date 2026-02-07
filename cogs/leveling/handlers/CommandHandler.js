const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

class CommandHandler {
  constructor(
    configManager,
    dataStore,
    xpService,
    leaderboardService,
    rewardService,
    logger,
  ) {
    this.configManager = configManager;
    this.dataStore = dataStore;
    this.xpService = xpService;
    this.leaderboardService = leaderboardService;
    this.rewardService = rewardService;
    this.logger = logger;
  }

  getCommands() {
    return [
      new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Mostra il rank (livello/xp) di un utente")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Utente (default: tu)")
            .setRequired(false),
        ),

      new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Mostra la classifica XP del server")
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Quanti utenti mostrare (1-25)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25),
        ),

      new SlashCommandBuilder()
        .setName("level")
        .setDescription("Gestione livelli/XP (staff)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sc) =>
          sc
            .setName("give")
            .setDescription("Aggiunge livelli a un utente")
            .addUserOption((o) =>
              o.setName("user").setDescription("Utente").setRequired(true),
            )
            .addIntegerOption((o) =>
              o
                .setName("amount")
                .setDescription("Livelli da aggiungere")
                .setRequired(true)
                .setMinValue(1),
            ),
        )
        .addSubcommand((sc) =>
          sc
            .setName("set")
            .setDescription("Imposta il livello di un utente")
            .addUserOption((o) =>
              o.setName("user").setDescription("Utente").setRequired(true),
            )
            .addIntegerOption((o) =>
              o
                .setName("amount")
                .setDescription("Livello target")
                .setRequired(true)
                .setMinValue(0),
            ),
        )
        .addSubcommand((sc) =>
          sc
            .setName("remove")
            .setDescription("Rimuove livelli a un utente")
            .addUserOption((o) =>
              o.setName("user").setDescription("Utente").setRequired(true),
            )
            .addIntegerOption((o) =>
              o
                .setName("amount")
                .setDescription("Livelli da rimuovere")
                .setRequired(true)
                .setMinValue(1),
            ),
        )
        .addSubcommand((sc) =>
          sc
            .setName("givexp")
            .setDescription("Aggiunge XP a un utente")
            .addUserOption((o) =>
              o.setName("user").setDescription("Utente").setRequired(true),
            )
            .addIntegerOption((o) =>
              o
                .setName("amount")
                .setDescription("XP da aggiungere")
                .setRequired(true)
                .setMinValue(1),
            ),
        )
        .addSubcommand((sc) =>
          sc
            .setName("setxp")
            .setDescription("Imposta gli XP di un utente")
            .addUserOption((o) =>
              o.setName("user").setDescription("Utente").setRequired(true),
            )
            .addIntegerOption((o) =>
              o
                .setName("amount")
                .setDescription("XP target")
                .setRequired(true)
                .setMinValue(0),
            ),
        )
        .addSubcommand((sc) =>
          sc
            .setName("removexp")
            .setDescription("Rimuove XP a un utente")
            .addUserOption((o) =>
              o.setName("user").setDescription("Utente").setRequired(true),
            )
            .addIntegerOption((o) =>
              o
                .setName("amount")
                .setDescription("XP da rimuovere")
                .setRequired(true)
                .setMinValue(1),
            ),
        ),

      new SlashCommandBuilder()
        .setName("rlevel")
        .setDescription("Reward roles per livello")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand((sc) =>
          sc
            .setName("add")
            .setDescription("Aggiunge un reward role a un livello")
            .addIntegerOption((o) =>
              o
                .setName("level")
                .setDescription("Livello")
                .setRequired(true)
                .setMinValue(1),
            )
            .addRoleOption((o) =>
              o
                .setName("role")
                .setDescription("Ruolo da assegnare")
                .setRequired(true),
            ),
        )
        .addSubcommand((sc) =>
          sc
            .setName("remove")
            .setDescription("Rimuove il reward role di un livello")
            .addIntegerOption((o) =>
              o
                .setName("level")
                .setDescription("Livello")
                .setRequired(true)
                .setMinValue(1),
            ),
        )
        .addSubcommand((sc) =>
          sc
            .setName("show")
            .setDescription("Mostra tutti i reward roles configurati"),
        ),

      new SlashCommandBuilder()
        .setName("leveling")
        .setDescription("Config base leveling")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sc) =>
          sc.setName("enable").setDescription("Abilita il leveling"),
        )
        .addSubcommand((sc) =>
          sc.setName("disable").setDescription("Disabilita il leveling"),
        )
        .addSubcommand((sc) =>
          sc
            .setName("setchannel")
            .setDescription("Imposta il canale annunci level-up (opzionale)")
            .addStringOption((o) =>
              o
                .setName("channel_id")
                .setDescription("ID canale (vuoto per disabilitare)")
                .setRequired(false),
            ),
        ),
    ];
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
      case "rank":
        return this.handleRank(interaction);
      case "leaderboard":
        return this.handleLeaderboard(interaction);
      case "level":
        return this.handleLevelAdmin(interaction);
      case "rlevel":
        return this.handleRLevel(interaction);
      case "leveling":
        return this.handleLevelingConfig(interaction);
      default:
        return null;
    }
  }

  async handleRank(interaction) {
    const user = interaction.options.getUser("user") || interaction.user;
    const entry = this.dataStore.ensureEntry(interaction.guildId, user.id);

    const guildData = this.dataStore.getGuildData(interaction.guildId);
    const sorted = Object.entries(guildData)
      .map(([userId, v]) => ({
        userId,
        xp: Number(v.xp || 0),
      }))
      .sort((a, b) => b.xp - a.xp);
    const rankIndex = sorted.findIndex((row) => row.userId === user.id);
    const rankLabel = rankIndex >= 0 ? `#${rankIndex + 1}` : "N/A";

    const levelMath = this.xpService.levelMath;
    const nextXp = levelMath.xpForLevel(entry.level + 1);
    const prevXp = levelMath.xpForLevel(entry.level);
    const progress = Math.max(0, entry.xp - prevXp);
    const needed = Math.max(1, nextXp - prevXp);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Rank ${rankLabel} - ${user.tag}`)
      .setDescription(`${user}`)
      .addFields(
        { name: "Posizione", value: rankLabel, inline: true },
        { name: "Livello", value: `${entry.level}`, inline: true },
        { name: "XP", value: `${entry.xp}`, inline: true },
        {
          name: "Progresso",
          value: `${progress}/${needed} (next: ${nextXp})`,
          inline: false,
        },
      );

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }

  async handleLeaderboard(interaction) {
    const limit = interaction.options.getInteger("limit") || 10;
    const rows = this.leaderboardService.getTop(interaction.guildId, limit);

    if (rows.length === 0) {
      return interaction.reply({
        content:
          "Nessun dato disponibile: scrivi qualche messaggio per iniziare a guadagnare XP.",
        ephemeral: true,
      });
    }

    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let name = r.userId;
      const member = await interaction.guild.members
        .fetch(r.userId)
        .catch(() => null);
      if (member) name = member.user.tag;

      lines.push(
        `**#${i + 1}** \`${name}\` — **Lv ${r.level}** • **${r.xp} XP**`,
      );
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 Leaderboard XP")
      .setDescription(lines.join("\n"));

    await interaction.reply({ embeds: [embed] });
  }

  async handleLevelAdmin(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "❌ Non hai i permessi per usare questo comando.",
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    const entry = this.dataStore.ensureEntry(interaction.guildId, user.id);
    const beforeLevel = entry.level;
    const beforeXp = entry.xp;

    const levelMath = this.xpService.levelMath;

    if (sub === "give") {
      entry.level = Math.max(0, entry.level + amount);
      entry.xp = Math.max(entry.xp, levelMath.xpForLevel(entry.level));
    } else if (sub === "set") {
      entry.level = Math.max(0, amount);
      entry.xp = Math.max(entry.xp, levelMath.xpForLevel(entry.level));
    } else if (sub === "remove") {
      entry.level = Math.max(0, entry.level - amount);
      entry.xp = Math.max(
        0,
        Math.min(entry.xp, levelMath.xpForLevel(entry.level + 1) - 1),
      );
    } else if (sub === "givexp") {
      entry.xp = Math.max(0, entry.xp + amount);
      entry.level = levelMath.levelFromXp(entry.xp);
    } else if (sub === "setxp") {
      entry.xp = Math.max(0, amount);
      entry.level = levelMath.levelFromXp(entry.xp);
    } else if (sub === "removexp") {
      entry.xp = Math.max(0, entry.xp - amount);
      entry.level = levelMath.levelFromXp(entry.xp);
    }

    entry.lastMessageAt = Date.now();
    this.dataStore.save();

    if (interaction.guild && interaction.member && entry.level > beforeLevel) {
      await this.rewardService.applyRoleRewards(
        interaction.guild,
        interaction.member,
        entry.level,
      );
    }

    const embed = new EmbedBuilder()
      .setTitle("✅ Leveling aggiornato")
      .setDescription(`Utente: ${user} (${user.tag})`)
      .addFields(
        {
          name: "Prima",
          value: `Lv ${beforeLevel} • ${beforeXp} XP`,
          inline: true,
        },
        {
          name: "Dopo",
          value: `Lv ${entry.level} • ${entry.xp} XP`,
          inline: true,
        },
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  async handleRLevel(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: "❌ Non hai i permessi per gestire i reward roles.",
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const level = interaction.options.getInteger("level");
      const role = interaction.options.getRole("role");

      const mapping = this.configManager.getRoleLevels();
      mapping[String(level)] = role.id;
      this.configManager.config.role_levels = mapping;
      this.configManager.save();

      return interaction.reply({
        content: `✅ Reward role impostato: **livello ${level}** → ${role} (${role.id})`,
        ephemeral: true,
      });
    }

    if (sub === "remove") {
      const level = interaction.options.getInteger("level");
      const mapping = this.configManager.getRoleLevels();

      if (!mapping[String(level)]) {
        return interaction.reply({
          content: `❌ Nessun reward role configurato per il livello ${level}.`,
          ephemeral: true,
        });
      }

      delete mapping[String(level)];
      this.configManager.config.role_levels = mapping;
      this.configManager.save();

      return interaction.reply({
        content: `✅ Reward role rimosso per il livello ${level}.`,
        ephemeral: true,
      });
    }

    if (sub === "show") {
      const mapping = this.configManager.getRoleLevels();
      const entries = Object.entries(mapping).sort(
        (a, b) => Number(a[0]) - Number(b[0]),
      );

      if (entries.length === 0) {
        return interaction.reply({
          content: "Nessun reward role configurato.",
          ephemeral: true,
        });
      }

      const lines = entries
        .map(([lvl, roleId]) => `• **Lv ${lvl}** → <@&${roleId}> (${roleId})`)
        .join("\n");
      const embed = new EmbedBuilder()
        .setTitle("🎖️ Reward roles (rlevel)")
        .setDescription(lines);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  async handleLevelingConfig(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "❌ Non hai i permessi per configurare il leveling.",
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "enable") {
      this.configManager.config.enabled = true;
      this.configManager.save();
      return interaction.reply({
        content: "✅ Leveling abilitato.",
        ephemeral: true,
      });
    }

    if (sub === "disable") {
      this.configManager.config.enabled = false;
      this.configManager.save();
      return interaction.reply({
        content: "✅ Leveling disabilitato.",
        ephemeral: true,
      });
    }

    if (sub === "setchannel") {
      const channelId = interaction.options.getString("channel_id") || null;
      this.configManager.config.announce_channel_id = channelId;
      this.configManager.save();

      return interaction.reply({
        content: channelId
          ? `✅ Canale annunci impostato su: <#${channelId}>`
          : "✅ Annunci level-up disabilitati.",
        ephemeral: true,
      });
    }
  }
}

module.exports = CommandHandler;
