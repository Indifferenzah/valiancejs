/**
 * Stato globale dell'applicazione
 */

// Map che tiene traccia delle sessioni di gioco attive per guild
const activeSessions = new Map();

// Map per indicare l'utente che sta impostando il ruleset per guild
const waitingForRulesetByGuild = new Map();

// Flag per indicare se il bot sta aspettando un messaggio di benvenuto
let waitingForWelcome = false;

// Flag per indicare se il bot sta aspettando un messaggio di boost
let waitingForBoost = false;

// Set per tracciare i recenti benvenuti e evitare duplicati
const recentWelcomes = new Set();

// Set per tracciare i recenti boost e evitare duplicati
const recentBoosts = new Set();

module.exports = {
  activeSessions,
  waitingForRulesetByGuild,
  waitingForWelcome,
  waitingForBoost,
  recentWelcomes,
  recentBoosts,
  // Funzioni per modificare le flag
  setWaitingForRuleset: (guildId, userId) => {
    if (!guildId) return;
    if (userId) {
      waitingForRulesetByGuild.set(guildId, userId);
    } else {
      waitingForRulesetByGuild.delete(guildId);
    }
  },
  getWaitingForRulesetUserId: (guildId) =>
    waitingForRulesetByGuild.get(guildId),
  setWaitingForWelcome: (value) => {
    module.exports.waitingForWelcome = value;
  },
  setWaitingForBoost: (value) => {
    module.exports.waitingForBoost = value;
  },
};
