const { disableAllComponents } = require('./buttons');
const logger = require('../services/logger');

async function createCollector(interaction, message, _timeoutMs, handler) {
  const collector = message.createMessageComponentCollector();

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: '❌ Questo non è il tuo menu.', ephemeral: true }).catch(() => {});
      return;
    }
    try {
      await handler(i);
    } catch (err) {
      logger.error('Collector handler error', err);
      await i.reply({ content: '❌ Errore interno.', ephemeral: true }).catch(() => {});
    }
  });

  return collector;
}

module.exports = { createCollector };
