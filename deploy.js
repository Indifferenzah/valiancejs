/**
 * Deploya i slash commands su Discord senza riavviare il bot.
 * Uso: node deploy.js
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');

// Ricava il clientId dal token (primo segmento base64)
const token    = process.env.TOKEN;
const clientId = Buffer.from(token.split('.')[0], 'base64').toString('utf8');

// ── Raccolta comandi ────────────────────────────────────────────────────────

// Comandi base (builders.js)
const { commands: baseCommands, contextMenus } = require('./src/commands/builders');

// Comandi ticket
const { getCommands: getTicketCommands } = require('./cogs/ticket/src/commands');

// Comandi log
const logCommands = require('./cogs/log/commands');

// Comandi counters (il costruttore non usa il client)
const { CountersCog } = (() => {
    // Esporta solo la classe senza avviare il bot
    const mod = require('./cogs/counters/counters');
    // Se il file esporta { CountersCog } o { setup }
    if (mod.CountersCog) return mod;
    // Altrimenti lo estraiamo dal modulo interno
    return { CountersCog: null };
})();

const allCommands = [
    ...baseCommands,
    ...contextMenus,
    ...getTicketCommands(),
    ...logCommands,
];

if (CountersCog) {
    try {
        const mockClient = {};
        const cog = new CountersCog(mockClient);
        allCommands.push(...cog.commands);
    } catch {
        console.warn('⚠️  Impossibile caricare i comandi counters, saltati.');
    }
}

// ── Deploy via REST ─────────────────────────────────────────────────────────

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`📡 Deploying ${allCommands.length} comandi (clientId: ${clientId})...`);

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: allCommands.map(c => c.toJSON()) },
        );

        console.log(`✅ Deploy completato! (${allCommands.length} comandi registrati)`);
        allCommands.forEach(c => console.log(`   • /${c.name}`));
    } catch (err) {
        console.error('❌ Errore durante il deploy:', err.message);
        process.exit(1);
    }
})();
