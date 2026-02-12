const logger = require("../../utils/logger");
const { OWNER_ID } = require("../../utils/botUtils");
const { getConfig, saveConfig } = require("../core/config");
const { activeSessions } = require("../state/sessionState");
const sessionState = require("../state/sessionState");

/**
 * Handler per l'evento messageCreate
 */
async function onMessageCreate(client, message) {
  if (message.author.bot) return;

  const config = getConfig();

  // Check per menzione bot
  const mentionPattern = new RegExp(`^<@!?${client.user.id}>$`);
  if (mentionPattern.test(message.content.trim())) {
    await message.channel.send(
      "❌ Sistema trasferito su comandi /. Usa `/help` per vedere una lista di comandi disponibili.",
    );
    return;
  }

  // Gestione attesa ruleset
  if (message.guild) {
    const waitingUserId = sessionState.getWaitingForRulesetUserId(
      message.guild.id,
    );
    if (waitingUserId && message.author.id === waitingUserId) {
      config.ruleset_message = message.content;
      saveConfig(config);
      sessionState.setWaitingForRuleset(message.guild.id, null);
      await message.react("✅");
      await message.channel.send(
        "✅ Ruleset salvato! Usa `/ruleset` per visualizzarlo.",
      );
      return;
    }
  }

  // Gestione attesa welcome
  if (sessionState.waitingForWelcome && message.author.id === OWNER_ID) {
    config.welcome_message.description = message.content;
    saveConfig(config);
    sessionState.setWaitingForWelcome(false);
    await message.react("✅");
    await message.channel.send(
      "✅ Messaggio di benvenuto salvato!\n\n**Variabili disponibili:**\n`{mention}` - Tag dell'utente\n`{username}` - Nome utente\n`{avatar}` - Avatar utente (per thumbnail)",
    );
    return;
  }

  // Check per prefissi
  const content = message.content.trim();
  const prefixes = config.prefixes || ["v!"];

  for (const prefix of prefixes) {
    if (content.startsWith(prefix)) {
      if (
        content.startsWith(prefix + "!") ||
        content.startsWith(prefix + "?")
      ) {
        return;
      }
      await message.channel.send(
        "❌ Sistema trasferito su comandi /. Usa `/help` per vedere una lista di comandi disponibili.",
      );
      return;
    }
  }

  // Reazioni welcome
  if (["wlc", "welcome", "benvenuto"].includes(message.content.toLowerCase())) {
    const emojis = config.welcome_emojis || [];
    for (const emoji of emojis) {
      try {
        await message.react(emoji);
      } catch (error) {
        logger.error(`Error adding reaction ${emoji}: ${error.message}`);
      }
    }
  }

  // Gestione tag per partite CW
  const guild = message.guild;
  if (!guild || !activeSessions.has(guild.id)) return;

  const session = activeSessions.get(guild.id);
  if (!session.isActive || message.channel !== session.textChannel) return;

  for (const mention of message.mentions.users.values()) {
    const member = guild.members.cache.get(mention.id);
    if (!member || session.taggedUsers.includes(member)) continue;

    const cwType = config.cw_type || "4v4";

    let teamSize;
    let maxPlayers;

    switch (cwType) {
      case "2v2":
        teamSize = 2;
        maxPlayers = 4;
        break;
      case "4v4":
      default:
        teamSize = 4;
        maxPlayers = 8;
        break;
    }

    session.taggedUsers.push(member);
    const position = session.taggedUsers.length - 1;

    if (position >= maxPlayers) return;

    const isRed = position < teamSize;

    if (member.voice && member.voice.channel) {
      try {
        const targetChannel = isRed ? session.redVoice : session.greenVoice;
        await member.voice.setChannel(targetChannel);
        const teamName = isRed ? "ROSSO" : "VERDE";
        logger.info(`Moved ${member.user.username} to team ${teamName}`);

        await session.textChannel.send(
          `${member.toString()} → ${isRed ? "Team Rosso" : "Team Verde"}`,
        );
      } catch (error) {
        logger.error(`Error moving ${member.user.username}: ${error.message}`);
      }
    }
  }
}

module.exports = { onMessageCreate };
