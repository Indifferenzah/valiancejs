const { EmbedBuilder } = require('discord.js');
const config = require('./config.json');

function getError(key, vars = {}) {
  let msg = config.errors[key] ?? `❌ Errore sconosciuto (${key})`;
  for (const [k, v] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return msg;
}

function buildErrorEmbed(message, color = config.colors.error) {
  return new EmbedBuilder()
    .setColor(color)
    .setDescription(message)
    .setTimestamp();
}

module.exports = { getError, buildErrorEmbed };
