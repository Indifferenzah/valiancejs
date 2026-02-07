const path = require("path");
const logger = require("../../utils/logger");

const ConfigManager = require("./core/ConfigManager");
const DataStore = require("./services/DataStore");
const RewardService = require("./services/RewardService");
const XpService = require("./services/XpService");
const LeaderboardService = require("./services/LeaderboardService");
const MessageXpHandler = require("./handlers/MessageXpHandler");
const VoiceXpHandler = require("./handlers/VoiceXpHandler");
const CommandHandler = require("./handlers/CommandHandler");

class LevelingCog {
  constructor(client) {
    this.client = client;
    this.name = "leveling";

    this.configPath = path.join(__dirname, "leveling.json");
    this.dataPath = path.join(__dirname, "levels.json");

    this.configManager = new ConfigManager(this.configPath);
    this.dataStore = new DataStore(this.dataPath);
    this.rewardService = new RewardService(this.configManager, logger);
    this.xpService = new XpService(
      this.configManager,
      this.dataStore,
      this.rewardService,
      logger,
    );
    this.leaderboardService = new LeaderboardService(this.dataStore);

    this.messageXpHandler = new MessageXpHandler(
      this.configManager,
      this.xpService,
    );
    this.voiceXpHandler = new VoiceXpHandler(
      this.configManager,
      this.xpService,
      logger,
    );
    this.commandHandler = new CommandHandler(
      this.configManager,
      this.dataStore,
      this.xpService,
      this.leaderboardService,
      this.rewardService,
      logger,
    );

    this.commands = this.commandHandler.getCommands();

    logger.info("[leveling] Enterprise-level leveling system initialized");
  }

  registerListeners() {
    if (this.client.__levelingEventsRegistered) return;
    this.client.__levelingEventsRegistered = true;

    this.client.on("messageCreate", async (message) => {
      await this.messageXpHandler.handle(message);
    });

    this.client.on("voiceStateUpdate", async (oldState, newState) => {
      await this.voiceXpHandler.handle(oldState, newState);
    });

    if (this.client.isReady()) {
      this.bootstrapVoiceXp();
    } else {
      this.client.once("ready", () => this.bootstrapVoiceXp());
    }

    this.client.on("interactionCreate", async (interaction) => {
      try {
        await this.commandHandler.handleInteraction(interaction);
      } catch (error) {
        logger.error(
          `[leveling] interaction error: ${error?.message || error}`,
        );
        if (interaction.isChatInputCommand() && !interaction.replied) {
          await interaction
            .reply({ content: "❌ Errore nel comando.", ephemeral: true })
            .catch(() => {});
        }
      }
    });
  }

  bootstrapVoiceXp() {
    this.voiceXpHandler.startExistingSessions(this.client);

    if (this.voiceXpInterval) return;
    const minSeconds = this.configManager.getVoiceXpConfig().minSeconds || 30;
    const intervalMs = Math.max(10000, minSeconds * 1000);

    this.voiceXpInterval = setInterval(async () => {
      await this.voiceXpHandler.tick(this.client);
    }, intervalMs);
  }
}

function setup(client) {
  const levelingCog = new LevelingCog(client);
  levelingCog.registerListeners();

  if (!client.globalCommands) client.globalCommands = [];
  client.globalCommands.push(...levelingCog.commands);

  return levelingCog;
}

module.exports = { setup, LevelingCog };
