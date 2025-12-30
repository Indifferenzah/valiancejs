/**
 * Stato globale dell'applicazione
 */

// Map che tiene traccia delle sessioni di gioco attive per guild
const activeSessions = new Map();

// Flag per indicare se il bot sta aspettando un messaggio di ruleset
let waitingForRuleset = false;

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
    waitingForRuleset,
    waitingForWelcome,
    waitingForBoost,
    recentWelcomes,
    recentBoosts,
    // Funzioni per modificare le flag
    setWaitingForRuleset: (value) => { module.exports.waitingForRuleset = value; },
    setWaitingForWelcome: (value) => { module.exports.waitingForWelcome = value; },
    setWaitingForBoost: (value) => { module.exports.waitingForBoost = value; }
};
