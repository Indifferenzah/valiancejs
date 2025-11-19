# Valiance Bot - JavaScript Version

Bot Discord completo per la gestione di server, completamente riscritto in JavaScript da Python.

## Caratteristiche

- **Sistema Ticket** - Gestione completa dei ticket con pannelli personalizzabili
- **Moderazione** - Ban, kick, mute, warn e altre funzioni di moderazione
- **AutoRole** - Assegnazione automatica ruoli con reazioni
- **Sistema Log** - Logging completo di tutti gli eventi del server
- **TTS** - Text-to-Speech con gTTS
- **Clan Wars** - Sistema per gestire le guerre interne del clan
- **Giveaway** - Sistema completo per giveaway
- **Livelli** - Sistema di livelli e XP (Coming Soon)
- **Reputation** - Sistema di reputazione tra utenti
- **Birthday** - Gestione compleanni
- **Counters** - Contatori automatici per membri, ruoli, etc.
- **Reminders** - Sistema promemoria
- **Fun Commands** - Comandi divertenti (userinfo, serverinfo, avatar, etc.)
- **Verify System** - Sistema di verifica con pulsanti

## Installazione

1. Clona il repository
2. Installa le dipendenze:
   ```bash
   npm install
   ```
3. Configura il file `.env`:
   ```
   TOKEN=your_bot_token_here
   MY_GUILD=your_guild_id_here
   ```
4. Configura il file `config.json` con le impostazioni del tuo server
5. Avvia il bot:
   ```bash
   npm start
   ```

## Struttura

```
valiancejs/
├── cogs/                 # Moduli del bot
│   ├── autorole/        # Sistema autorole
│   ├── birthdays/       # Sistema compleanni
│   ├── counters/        # Contatori automatici
│   ├── cw/              # Clan Wars
│   ├── fun/             # Comandi divertenti
│   ├── giveaway/        # Sistema giveaway
│   ├── help/            # Sistema help
│   ├── levels/          # Sistema livelli
│   ├── log/             # Sistema logging
│   ├── moderation/      # Sistema moderazione
│   ├── regole/          # Sistema regole
│   ├── rep/             # Sistema reputazione
│   ├── social/          # Sistema social (matrimoni)
│   ├── stats/           # Statistiche
│   ├── ticket/          # Sistema ticket
│   ├── tts/             # Text-to-Speech
│   └── util/            # Utilità (reminders)
├── data/                # File di dati JSON
├── utils/               # Utilità generali
├── views/               # Viste Discord (pulsanti, menu)
├── config.json          # Configurazione principale
├── index.js             # File principale
└── package.json         # Dipendenze npm
```

## Comandi Principali

### Moderazione
- `/ban <utente> [motivo]` - Banna un utente
- `/kick <utente> [motivo]` - Kicka un utente
- `/mute <utente>` - Muta un utente
- `/warn <utente> [motivo]` - Avverte un utente

### Ticket
- `/ticketpanel` - Crea il pannello ticket
- `/close` - Chiude un ticket
- `/add <utente>` - Aggiunge utente al ticket

### Utilità
- `/ping` - Mostra la latenza
- `/purge <numero>` - Elimina messaggi
- `/embed` - Crea embed personalizzati
- `/verify panel` - Crea pannello verifica

### Fun
- `/userinfo [utente]` - Info su un utente
- `/serverinfo` - Info sul server
- `/avatar [utente]` - Avatar di un utente
- `/coinflip` - Lancia una moneta
- `/roll [max]` - Tira un dado

## Configurazione

Il file `config.json` contiene tutte le configurazioni del bot:

- **Canali**: ID dei canali per welcome, boost, log, etc.
- **Ruoli**: ID dei ruoli per staff, moderatori, etc.
- **Messaggi**: Template per messaggi di benvenuto, boost, etc.
- **Ticket**: Configurazione del sistema ticket
- **Moderazione**: Impostazioni di moderazione
- **Bot**: Status, attività, prefissi

## Dipendenze

- `discord.js` - Libreria Discord
- `@discordjs/voice` - Supporto audio
- `gtts` - Text-to-Speech
- `winston` - Logging
- `canvas` - Generazione immagini
- `sqlite3` - Database (futuro)
- `axios` - HTTP requests
- `dotenv` - Variabili ambiente

## Sviluppo

Il bot è strutturato in moduli (cogs) per facilitare lo sviluppo e la manutenzione. Ogni cog è indipendente e gestisce una specifica funzionalità.

Per aggiungere un nuovo cog:
1. Crea una cartella in `cogs/`
2. Crea il file principale `nome.js`
3. Implementa la classe del cog con il metodo `setup()`
4. Aggiungi il cog alla lista in `index.js`

## Supporto

Per supporto o segnalazioni:
- Discord: https://discord.gg/K4TvkbV2su
- Developer: `indifferenzah`

## Licenza

Questo progetto è privato e proprietario di Valiance.