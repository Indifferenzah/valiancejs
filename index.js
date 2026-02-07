/**
 * Entry point principale del bot Discord Valiance
 * Questo file coordina tutti i moduli e avvia il bot
 */

require("dotenv").config();

const logger = require("./utils/logger");

// Importazione dei moduli core
const { createClient } = require("./src/core/client");
const { loadConfig } = require("./src/core/config");

// Importazione dei servizi
const { loadCogs } = require("./src/services/cogLoader");
const {
  reloadGlobalConfig,
  reloadAll,
} = require("./src/services/reloadService");
const { testDb } = require("./src/testdb");

// Importazione event handlers
const { onReady } = require("./src/events/ready");
const { onInteractionCreate } = require("./src/events/interactionCreate");
const { onVoiceStateUpdate } = require("./src/events/voiceStateUpdate");
const { onGuildMemberAdd } = require("./src/events/guildMemberAdd");
const { onGuildMemberUpdate } = require("./src/events/guildMemberUpdate");
const { onMessageCreate } = require("./src/events/messageCreate");
const { printBootReport } = require("./src/services/bootReport");

// Importazione dello stato globale
const { activeSessions, cleanupSession } = require("./src/game/gameManager");
const { GameSession } = require("./src/game/GameSession");
const sessionState = require("./src/state/sessionState");

// Carica la configurazione
const config = loadConfig();

// Crea il client Discord
const client = createClient();

// Carica tutti i cogs
const cogResults = loadCogs(client);
printBootReport({ cogs: cogResults });

// Registra gli event handlers
client.once("clientReady", () => onReady(client));
client.on("interactionCreate", (interaction) =>
  onInteractionCreate(client, interaction),
);
client.on("voiceStateUpdate", (oldState, newState) =>
  onVoiceStateUpdate(client, oldState, newState),
);
client.on("guildMemberAdd", (member) => onGuildMemberAdd(client, member));
client.on("guildMemberUpdate", (oldMember, newMember) =>
  onGuildMemberUpdate(client, oldMember, newMember),
);
client.on("messageCreate", (message) => onMessageCreate(client, message));

// Esporta per compatibilità con altri moduli
module.exports = {
  client,
  config,
  activeSessions,
  waitingForRuleset: sessionState.waitingForRuleset,
  waitingForWelcome: sessionState.waitingForWelcome,
  waitingForBoost: sessionState.waitingForBoost,
  cleanupSession,
  GameSession,
  reloadGlobalConfig: () => reloadGlobalConfig(client),
  reloadAll: () => reloadAll(client),
};

// Avvia il bot
testDb()
  .catch((error) => logger.error(`[DB] Test error: ${error.message}`))
  .finally(() => {
    client
      .login(process.env.TOKEN)
      .then(() => logger.info("Bot login successful"))
      .catch((error) => {
        logger.error(`Failed to login: ${error.message}`);
        process.exit(1);
      });
  });
