const path = require("path");
const logger = require("../../utils/logger");

const ConfigManager = require("./core/ConfigManager");
const EmbedFactory = require("./core/EmbedFactory");
const BlacklistService = require("./services/BlacklistService");
const TTSService = require("./services/TTSService");
const VoiceSessionService = require("./services/VoiceSessionService");
const CommandHandler = require("./handlers/CommandHandler");
const MessageHandler = require("./handlers/MessageHandler");
const PrefixCommandHandler = require("./handlers/PrefixCommandHandler");

class TTSCog {
  constructor(client) {
    this.client = client;
    this.name = "tts";

    this.configPath = path.join(__dirname, "tts.json");
    this.mainConfigPath = path.join(__dirname, "../../config.json");
    this.blacklistPath = path.join(__dirname, "blacklisted.json");

    this.configManager = new ConfigManager(this.configPath);
    this.blacklistService = new BlacklistService(this.blacklistPath);
    this.embedFactory = new EmbedFactory(this.mainConfigPath);
    this.ttsService = new TTSService(this.configManager, logger);
    this.voiceSessionService = new VoiceSessionService(
      this.ttsService,
      this.configManager,
      logger,
    );

    this.commandHandler = new CommandHandler({
      configManager: this.configManager,
      blacklistService: this.blacklistService,
      voiceSessionService: this.voiceSessionService,
      embedFactory: this.embedFactory,
      logger,
    });

    this.messageHandler = new MessageHandler({
      configManager: this.configManager,
      blacklistService: this.blacklistService,
      voiceSessionService: this.voiceSessionService,
      logger,
    });

    this.prefixCommandHandler = new PrefixCommandHandler({
      configManager: this.configManager,
      voiceSessionService: this.voiceSessionService,
      embedFactory: this.embedFactory,
      logger,
    });

    this.commands = this.commandHandler.getCommands();

    logger.info("[TTS] Sistema TTS enterprise-level inizializzato");
  }

  registerListeners() {
    if (this.client.__ttsEventsRegistered) {
      return;
    }

    this.client.__ttsEventsRegistered = true;

    this.client.on("interactionCreate", (interaction) => {
      this.commandHandler.handleInteraction(interaction);
    });

    this.client.on("messageCreate", (message) => {
      this.prefixCommandHandler.handleMessage(message);
      this.messageHandler.handleMessage(message);
    });
  }
}

function setup(client) {
  const cog = new TTSCog(client);
  cog.registerListeners();

  if (!client.globalCommands) client.globalCommands = [];
  client.globalCommands.push(...cog.commands);

  return cog;
}

module.exports = { setup, TTSCog };
