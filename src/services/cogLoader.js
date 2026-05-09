const fs = require("fs");
const path = require("path");

/**
 * Carica tutti i cogs dalla cartella cogs
 */
function loadCogs(client) {
  const cogsToLoad = [
    "ticket/ticket",
    "moderation/moderation",
    "autorole/autorole",
    "log/log",
    "fun/fun",
    "regole/regole",
    "tts/tts",
    "cw/cw",
    "giveaway/giveaway",
    "help",
    "util/reminders",
    "social/marriage",
    "rep/reputation",
    "birthdays/birthdays",
    "counters/counters",
    // "aimod/aimod",
    "coralmc/coralmc",
    "traduttore/traduttore",
    "leveling/leveling",
    "invites/invites"
  ];

  const results = [];
  const addResult = (name, ok) => {
    results.push({ name, ok });
  };

  for (const cogPath of cogsToLoad) {
    try {
      const cogFile = path.join(process.cwd(), "cogs", `${cogPath}.js`);
      if (fs.existsSync(cogFile)) {
        delete require.cache[require.resolve(cogFile)];
        const cog = require(cogFile);
        if (cog.setup) {
          const cogInstance = cog.setup(client);
          const cogName = cogPath.split("/").pop();
          client.cogs.set(cogName, cogInstance);
          addResult(cogName, true);
        } else {
          addResult(cogPath, false);
        }
      } else {
        addResult(cogPath, false);
      }
    } catch (error) {
      addResult(cogPath, false);
    }
  }

  // Bind AI-MOD con moderation se entrambi sono caricati
  const aimodCog = client.cogs.get("aimod");
  const moderationCog = client.cogs.get("moderation");

  if (aimodCog && moderationCog) {
    aimodCog.bindModerationCog(moderationCog);
  } else {
    addResult("aimod<->moderation", false);
  }

  return results;
}

module.exports = { loadCogs };
