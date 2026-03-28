const path = require('path');

const MODULE_NAME = 'TICKET';

const BASE_DIR = __dirname;
const ROOT_DIR  = path.join(BASE_DIR, '../..');
const DATA_DIR  = path.join(ROOT_DIR, 'data');

const PATHS = {
    CONFIG:         path.join(ROOT_DIR, 'config.json'),
    TICKET_JSON:    path.join(DATA_DIR,  'ticket.json'),
    CLOSED_TICKETS: path.join(DATA_DIR,  'closed_tickets.json'),
    BLACKLIST:      path.join(DATA_DIR,  'blacklist.json'),
    TICKET_MSGS:    path.join(BASE_DIR,  'ticketmsg.json'),
    TRANSCRIPTS:    path.join(ROOT_DIR,  'transcripts'),
};

const ROLE_IDS = {
    CW_STAFF: '1350073967716732971',
};

const COMMAND_NAMES = [
    'ticketpanel', 'close', 'rename', 'blacklist',
    'add', 'remove', 'list', 'transcript', 'sendtranscript',
];

const MESSAGES = {
    ERROR: {
        NO_PERMISSION:          '❌ Non hai i permessi per usare questo comando!',
        NOT_A_TICKET:           '❌ Questo comando può essere usato solo nei canali ticket!',
        NOT_A_VALID_TICKET:     '❌ Questo non è un canale ticket valido!',
        BLACKLISTED:            '❌ Sei nella blacklist e non puoi aprire ticket!',
        TICKET_NOT_FOUND:       '❌ Ticket non trovato!',
        BUTTON_NOT_FOUND:       '❌ Configurazione pulsante non trovata!',
        TRANSCRIPT_NOT_FOUND:   '❌ Transcript non trovato!',
        CANNOT_REMOVE_OWNER:    '❌ Non puoi rimuovere il proprietario del ticket!',
        CANNOT_REMOVE_STAFF:    '❌ Non puoi rimuovere uno staffer!',
        NAME_TOO_LONG:          '❌ Il nome è troppo lungo! (max 100 caratteri)',
        NO_TARGET:              '❌ Devi specificare almeno un utente o un ruolo!',
        DM_CLOSED:              "❌ Non posso inviare il DM: l'utente ha i DM chiusi.",
        CREATE_FAILED:          '❌ Errore nella creazione del ticket!',
        CLOSE_FAILED:           '❌ Errore nella chiusura del ticket!',
        SEND_TRANSCRIPT_FAILED: '❌ Errore durante l\'invio del transcript.',
        ONLY_STAFF_CLOSE:       '❌ Solo uno staffer può chiudere il ticket!',
        PERM_RENAME:            '❌ Non ho i permessi per rinominare il canale!',
        RENAME_FAILED:          '❌ Errore nel rinominare: {error}',
        GENERIC:                '❌ Errore: {error}',
    },
    SUCCESS: {
        PANEL_CREATED:      '✅ Pannello ticket creato!',
        CONFIG_RELOADED:    '✅ Configurazione ticket ricaricata con successo!',
        CHANNEL_RENAMED:    '✅ Canale rinominato!',
        BLACKLIST_ADDED:    '✅ {member} è stato aggiunto alla blacklist!',
        BLACKLIST_REMOVED:  '✅ {member} è stato rimosso dalla blacklist!',
        TICKET_CREATED:     '🎫 Ticket creato: {channel}',
        TRANSCRIPT_SENT:    '✅ Transcript del ticket #{number} inviato in DM a {user}.',
        ADDED_TO_TICKET:    '✅ {targets} aggiunto/a al ticket!',
        REMOVED_FROM_TICKET: '✅ {member} rimosso!',
    },
    INFO: {
        CLOSE_CANCELLED: 'Chiusura annullata.',
        MAX_TICKETS:     '⚠️ Hai già {count} ticket aperti (limite: {max}). Chiudi uno di questi prima di aprirne un altro.',
    },
};

module.exports = { MODULE_NAME, PATHS, ROLE_IDS, COMMAND_NAMES, MESSAGES };
