const { EmbedBuilder } = require("discord.js");
const { loadJsonSync } = require("../../../utils/jsonStore");

class EmbedFactory {
  constructor(mainConfigPath) {
    this.mainConfigPath = mainConfigPath;
  }

  getTemplate(type) {
    try {
      const cfg = loadJsonSync(this.mainConfigPath, {});
      if (cfg?.tts_embeds?.[type]) return cfg.tts_embeds[type];
      if (cfg?.[type]) return cfg[type];
    } catch (error) {
      return null;
    }
    return null;
  }

  parseColor(color) {
    if (typeof color === "number") return color;
    if (typeof color === "string") {
      const cleaned = color.replace("#", "");
      const parsed = Number.parseInt(cleaned, 16);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  }

  build(type, executor, guild, extra = {}) {
    const template = this.getTemplate(type);
    if (!template) return null;

    const avatarURL =
      executor?.displayAvatarURL?.({ dynamic: true }) ||
      executor?.user?.displayAvatarURL?.({ dynamic: true }) ||
      null;
    const username =
      executor?.user?.username ||
      executor?.username ||
      executor?.user?.tag ||
      executor?.tag ||
      "";
    const displayName =
      executor?.displayName || executor?.globalName || username;
    const mention =
      executor?.toString?.() ||
      (executor?.user?.id
        ? `<@${executor.user.id}>`
        : executor?.id
          ? `<@${executor.id}>`
          : "");

    const replacements = {
      mention,
      user: displayName,
      channel: extra.channel || "",
    };

    const applyReplacements = (text = "") => {
      if (typeof text !== "string") return text;
      return text
        .replace(/\{mention\}/gi, replacements.mention)
        .replace(/\{user\}/gi, replacements.user)
        .replace(/\{channel\}/gi, replacements.channel);
    };

    const embed = new EmbedBuilder();

    embed.setAuthor({
      name: displayName || replacements.user,
      iconURL: avatarURL,
    });

    if (template.title) embed.setTitle(applyReplacements(template.title));
    if (template.description) {
      embed.setDescription(applyReplacements(template.description));
    }

    const color = this.parseColor(template.color);
    if (color !== null) embed.setColor(color);

    if (template.thumbnail) {
      embed.setThumbnail(applyReplacements(template.thumbnail));
    }

    const footerText = template.footer
      ? applyReplacements(template.footer)
      : "";
    const footerIcon = guild?.iconURL?.({ dynamic: true }) || null;
    if (footerText || footerIcon) {
      embed.setFooter({
        text: footerText || " ",
        iconURL: footerIcon,
      });
    }

    return embed;
  }
}

module.exports = EmbedFactory;
