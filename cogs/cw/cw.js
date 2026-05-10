const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { loadJsonSync } = require("../../utils/jsonStore");
const { ownerOrHasPermissions } = require("../../utils/botUtils");
const logger = require("../../utils/logger");
const path = require("path");

class CwCog {
  constructor(client) {
    this.client = client;
    this.configPath = path.join(__dirname, "cw.json");
    this.config = this.loadConfig();

    this.commands = [
      new SlashCommandBuilder()
        .setName("cw")
        .setDescription("Invia risultato CW")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption((o) =>
          o.setName("numero").setDescription("Numero CW").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("data")
            .setDescription("Data (DD/MM/YYYY)")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("ora").setDescription("Ora (HH:MM)").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("rossi").setDescription("Team Rosso").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("verdi").setDescription("Team Verde").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("mappe")
            .setDescription("Mappe (separa con ; o a capo)")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("recap")
            .setDescription("Recap (separa con ; o a capo)")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("vincitore")
            .setDescription("Vincitore (testo libero)")
            .setRequired(true),
        ),
    ];
  }

  loadConfig() {
    return loadJsonSync(this.configPath, {});
  }

  parseTemplate(template, values) {
    return template.replace(/\{(\w+)\}/g, (_, key) =>
      values[key] !== undefined ? values[key] : `{${key}}`,
    );
  }

  formatList(raw, suffixTemplate, indexKey) {
    if (!raw) return "";

    const items = raw
      .replace(/\r/g, "")
      .split(/\s*;\s*|\n+/)
      .map((v) => v.trim())
      .filter(Boolean);

    return items
      .map((item, i) => {
        const suffix = suffixTemplate
          ? " " + suffixTemplate.replace(`{${indexKey}}`, i + 1)
          : "";
        return `> ${item}${suffix}`;
      })
      .join("\n");
  }

  formatListPrefix(raw, prefixTemplate, indexKey) {
    if (!raw) return "";

    const items = raw
      .replace(/\r/g, "")
      .split(/\s*;\s*|\n+/)
      .map((v) => v.trim())
      .filter(Boolean);

    return items
      .map((item, i) => {
        const prefix = prefixTemplate
          ? prefixTemplate.replace(`{${indexKey}}`, i + 1) + " "
          : "";
        return `> ${prefix}${item}`;
      })
      .join("\n");
  }

  escapeMarkdown(text) {
    if (!text) return text;
    return text.replace(/_/g, "\\_");
  }

  formatTeam(raw) {
    if (!raw) return "";

    const maxPlayers = 4;

    const players = raw
      .replace(/\r/g, "")
      .split(/\s*;\s*|\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    return players
      .map((player, index) => {
        const isSub = index >= maxPlayers;
        return `> ${player}${isSub ? " (SUB)" : ""}`;
      })
      .join("\n");
  }

  async handleCw(interaction) {
    if (
      !ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)
    ) {
      return interaction.reply({
        content: "❌ Non hai i permessi per usare questo comando.",
        ephemeral: true,
      });
    }

    const values = {
      numerocw: interaction.options.getInteger("numero"),
      data: this.escapeMarkdown(interaction.options.getString("data")),
      ora: this.escapeMarkdown(interaction.options.getString("ora")),
      rossi: this.formatTeam(
        this.escapeMarkdown(interaction.options.getString("rossi")),
      ),
      verdi: this.formatTeam(
        this.escapeMarkdown(interaction.options.getString("verdi")),
      ),
      mappe: this.formatList(
        this.escapeMarkdown(interaction.options.getString("mappe")),
        this.config.prefix_map || "(#{num_map})",
        "num_map",
      ),
      recap: this.formatListPrefix(
        this.escapeMarkdown(interaction.options.getString("recap")),
        this.config.prefix_recap || "**#{num_recap}:**",
        "num_recap",
      ),
      vincitore: this.escapeMarkdown(
        interaction.options.getString("vincitore"),
      ),
    };

    const description = this.parseTemplate(
      this.config.embed_description || "",
      values,
    );
    const truncated =
      description.length > 4096
        ? (logger.warn(
            `CW #${values.numerocw}: description truncated (${description.length} > 4096 chars)`,
          ),
          description.slice(0, 4093) + "...")
        : description;

    const embed = new EmbedBuilder()
      .setTitle(this.config.embed_title || "CW")
      .setDescription(truncated || null)
      .setColor(this.config.embed_color || 0x3498db)
      .setFooter(this.config.footer ? { text: this.config.footer } : null)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    logger.info(`CW #${values.numerocw} inviato da ${interaction.user.tag}`);
  }
}

function setup(client) {
  const cwCog = new CwCog(client);

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "cw") return;

    try {
      await cwCog.handleCw(interaction);
    } catch (err) {
      logger.error(`Error in CW command: ${err.stack || err.message}`);
      if (!interaction.replied) {
        await interaction.reply({
          content: "❌ Errore interno nel comando CW.",
          ephemeral: true,
        });
      }
    }
  });

  if (!client.globalCommands) client.globalCommands = [];
  client.globalCommands.push(...cwCog.commands);

  return cwCog;
}

module.exports = { setup, CwCog };
