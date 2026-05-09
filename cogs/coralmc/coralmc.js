const path = require('path');
const CoralMCApi = require('./services/api');
const logger = require('./services/logger');
const coral = require('./commands/coral');
const coralcog = require('./commands/coralcog');

const REQUIRED_CONFIG_FIELDS = ['baseUrl', 'contact'];

function loadConfig() {
  const cfg = require('./config.json');
  for (const field of REQUIRED_CONFIG_FIELDS) {
    if (!cfg[field]) throw new Error(`[CoralMC] config.json manca del campo richiesto: "${field}"`);
  }
  return cfg;
}

function setup(client) {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error('Impossibile caricare config.json', err);
    throw err;
  }

  const api = new CoralMCApi(config);
  const loadedAt = Date.now();

  logger.info(`Cog inizializzato — baseUrl: ${config.baseUrl}`);

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'coral') {
          await coral.handleAutocomplete(interaction, api);
        }
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === 'coral') {
        await coral.handleCommand(interaction, api);
        return;
      }

      if (interaction.commandName === 'coralcog') {
        await coralcog.handleCommand(interaction, api, loadedAt);
        return;
      }
    } catch (err) {
      logger.error('interactionCreate unhandled error', err);
      try {
        const msg = '❌ Errore inaspettato nel cog CoralMC.';
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: msg, components: [] });
        } else if (interaction.isChatInputCommand()) {
          await interaction.reply({ content: msg, ephemeral: true });
        }
      } catch {}
    }
  });

  if (!client.globalCommands) client.globalCommands = [];
  client.globalCommands.push(coral.builder, coralcog.builder);

  return { commands: [coral.builder, coralcog.builder], api };
}

module.exports = { setup };
