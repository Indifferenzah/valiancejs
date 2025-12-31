const { PermissionFlagsBits } = require('discord.js');

const MODULE_NAME = 'MODERATION';
const DEFAULT_TIMEOUT_DURATION = '10m';

const PERMISSION_MAP = {
    ban: PermissionFlagsBits.BanMembers,
    kick: PermissionFlagsBits.KickMembers,
    timeout: PermissionFlagsBits.ModerateMembers,
    mute: PermissionFlagsBits.ModerateMembers,
    unmute: PermissionFlagsBits.ModerateMembers,
    nick: PermissionFlagsBits.ManageNicknames,
    unban: PermissionFlagsBits.BanMembers
};

const ACTION_TYPES = {
    BAN: 'ban',
    UNBAN: 'unban',
    KICK: 'kick',
    MUTE: 'mute',
    TIMEOUT: 'timeout',
    UNMUTE: 'unmute',
    NICK: 'nick'
};

const COLORS = {
    BAN: 0xFF0000,
    UNBAN: 0x00FF00,
    KICK: 0xFFA500,
    MUTE: 0x808080,
    UNMUTE: 0x00FF00,
    SUCCESS: 0x00FF00,
    ERROR: 0xFF0000,
    INFO: 0x3498DB,
    WARNING: 0xF39C12
};

const MESSAGES = {
    ERROR: {
        INTERNAL: '⚠️ **Errore di Sistema** — Si è verificato un errore imprevisto. Contatta un amministratore se persiste.',
        NO_PERMISSION: '🚫 **Accesso Negato** — Non hai i permessi necessari per eseguire questa azione di moderazione.',
        INVALID_USER: '👤 **Target Non Valido** — L\'utente specificato non è stato trovato o non è un membro valido.',
        INVALID_DURATION: '⏱️ **Durata Non Valida** — Usa un formato durata valido (es: 10m, 1h, 2d).',
        USER_NOT_BANNED: '🔍 **Non Bannato** — Questo utente non è attualmente bannato.',
        CANNOT_ACTION_SELF: '🚷 **Azione Non Valida** — Non puoi eseguire questa azione di moderazione su te stesso.',
        CANNOT_ACTION_BOT: '🤖 **Target Protetto** — Le azioni di moderazione non possono essere eseguite sui bot.',
        HIERARCHY_ERROR: '⚡ **Errore Gerarchia Ruoli** — Non puoi moderare utenti con ruoli uguali o superiori.',
        MISSING_DURATION: '⏱️ **Durata Richiesta** — Specifica una durata per il timeout.',
        NICKNAME_TOO_LONG: '📏 **Nickname Troppo Lungo** — I nickname devono essere di 32 caratteri o meno.',
        OPERATION_FAILED: '❌ **Operazione Fallita** — {action} non può essere completata: {error}'
    },

    SUCCESS: {
        BAN: '✅ **Membro Bannato** — {user} è stato bannato permanentemente dal server.',
        UNBAN: '✅ **Membro Sbannato** — L\'utente con ID {userId} è stato sbannato con successo.',
        KICK: '✅ **Membro Kickato** — {user} è stato rimosso dal server.',
        MUTE: '✅ **Membro in Timeout** — {user} è stato messo in timeout per {duration}.',
        UNMUTE: '✅ **Timeout Rimosso** — {user} può ora parlare di nuovo.',
        NICK_CHANGED: '✅ **Nickname Aggiornato** — Il nickname di {user} è stato cambiato in "{nick}".',
        ACTION_COMPLETED: '✅ **{action}** eseguito con successo su **{user}**.'
    },

    INFO: {
        NO_REASON: 'Nessun motivo specificato',
        DEFAULT_REASON: 'Azione di moderazione',
        PROCESSING: '⏳ Elaborazione azione di moderazione...'
    }
};

const EMBED_TEMPLATES = {
    BAN: {
        title: '🔨 Membro Bannato',
        color: COLORS.BAN,
        icon: '🔨'
    },
    UNBAN: {
        title: '♻️ Membro Sbannato',
        color: COLORS.UNBAN,
        icon: '♻️'
    },
    KICK: {
        title: '👢 Membro Kickato',
        color: COLORS.KICK,
        icon: '👢'
    },
    MUTE: {
        title: '🔇 Membro in Timeout',
        color: COLORS.MUTE,
        icon: '🔇'
    },
    UNMUTE: {
        title: '🔊 Timeout Rimosso',
        color: COLORS.UNMUTE,
        icon: '🔊'
    }
};

const DURATION_UNITS = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
};

const MAX_TIMEOUT_DURATION = 28 * 24 * 60 * 60 * 1000;

const AUTOCOMPLETE_MAX_RESULTS = 25;

module.exports = {
    MODULE_NAME,
    DEFAULT_TIMEOUT_DURATION,
    PERMISSION_MAP,
    ACTION_TYPES,
    COLORS,
    MESSAGES,
    EMBED_TEMPLATES,
    DURATION_UNITS,
    MAX_TIMEOUT_DURATION,
    AUTOCOMPLETE_MAX_RESULTS
};
