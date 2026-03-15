const fs = require('fs');
const path = require('path');
const { loadJsonSync, saveJsonSync } = require('../../../../utils/jsonStore');
const logger = require('../../../../utils/logger');
const { PATHS, MODULE_NAME } = require('../../constants');

/**
 * Centralized persistence layer for the ticket system.
 * Exported as a singleton so all handlers share the same in-memory state.
 */
class TicketStore {
    constructor() {
        this._config        = loadJsonSync(PATHS.CONFIG);
        this._ticketMsgs    = loadJsonSync(PATHS.TICKET_MSGS, {});
        this._tickets       = this._loadTickets();
        this._closedTickets = loadJsonSync(PATHS.CLOSED_TICKETS, {});
        this._blacklist     = loadJsonSync(PATHS.BLACKLIST, []);
    }

    // ── Config ─────────────────────────────────────────────────────────────

    get config() { return this._config; }

    saveConfig() {
        saveJsonSync(PATHS.CONFIG, this._config);
    }

    // ── Ticket Messages (ticketmsg.json) ───────────────────────────────────

    get ticketMessages() { return this._ticketMsgs; }

    reloadMessages() {
        this._ticketMsgs = loadJsonSync(PATHS.TICKET_MSGS, {});
        logger.info(`[${MODULE_NAME}] Ticket messages reloaded.`);
    }

    // ── Active Tickets ─────────────────────────────────────────────────────

    getTicket(channelId) {
        return this._tickets[channelId] || null;
    }

    setTicket(channelId, info) {
        this._tickets[channelId] = info;
        this._saveTickets();
    }

    updateTicketField(channelId, field, value) {
        if (this._tickets[channelId]) {
            this._tickets[channelId][field] = value;
            this._saveTickets();
        }
    }

    deleteTicket(channelId) {
        delete this._tickets[channelId];
        this._saveTickets();
    }

    getOpenTicketsByUser(userId) {
        return Object.entries(this._tickets).filter(
            ([, info]) => this.extractOwnerId(info) === userId
        );
    }

    // ── Closed Tickets ─────────────────────────────────────────────────────

    getClosedTicket(number) {
        return this._closedTickets[String(number)] || null;
    }

    saveClosedTicket(number, data) {
        this._closedTickets[String(number)] = data;
        saveJsonSync(PATHS.CLOSED_TICKETS, this._closedTickets);
    }

    getClosedTicketsByUser(userId) {
        return Object.entries(this._closedTickets).filter(
            ([, info]) => String(info.owner) === userId
        );
    }

    // ── Blacklist ──────────────────────────────────────────────────────────

    isBlacklisted(userId) {
        return this._blacklist.includes(userId);
    }

    /**
     * Toggles a user's blacklist status.
     * @returns {boolean} true if added, false if removed.
     */
    toggleBlacklist(userId) {
        if (this.isBlacklisted(userId)) {
            this._blacklist = this._blacklist.filter(id => id !== userId);
            saveJsonSync(PATHS.BLACKLIST, this._blacklist);
            return false;
        }
        this._blacklist.push(userId);
        saveJsonSync(PATHS.BLACKLIST, this._blacklist);
        return true;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    extractOwnerId(ticketInfo) {
        if (!ticketInfo) return null;
        const raw = (typeof ticketInfo === 'object' && 'owner' in ticketInfo)
            ? ticketInfo.owner
            : ticketInfo;
        return raw !== undefined && raw !== null ? String(raw) : null;
    }

    /**
     * Returns the absolute path to a transcript file, or null if not found.
     */
    resolveTranscriptFile(number, ticketInfo) {
        const stored   = ticketInfo?.transcript_file;
        const fallback = path.join(PATHS.TRANSCRIPTS, `transcript-${number}.txt`);
        if (stored   && fs.existsSync(stored))   return stored;
        if (fs.existsSync(fallback)) return fallback;
        return null;
    }

    // ── Private persistence ────────────────────────────────────────────────

    _loadTickets() {
        try {
            const raw = fs.readFileSync(PATHS.TICKET_JSON, 'utf8');
            // Strip BOM, trailing commas, coerce Discord snowflake IDs to strings
            const sanitized = raw
                .replace(/\uFEFF/g, '')
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/("owner": )(\d+)/g, '$1"$2"')
                .replace(/("close_message_id": )(\d+)/g, '$1"$2"');
            try {
                return this._normalizeTickets(JSON.parse(sanitized));
            } catch (parseErr) {
                const backupPath = `${PATHS.TICKET_JSON}.bak`;
                fs.writeFileSync(backupPath, raw, 'utf8');
                logger.error(`[${MODULE_NAME}] Cannot parse ticket.json: ${parseErr.message}. Backup at ${backupPath}`);
                return {};
            }
        } catch (err) {
            if (err.code === 'ENOENT') return {};
            throw err;
        }
    }

    _normalizeTickets(data = {}) {
        const out = {};
        for (const [channelId, info] of Object.entries(data)) {
            if (info && typeof info === 'object') {
                out[channelId] = { ...info };
                if (info.owner !== undefined)
                    out[channelId].owner = String(info.owner);
                if (info.close_message_id !== undefined)
                    out[channelId].close_message_id = String(info.close_message_id);
            } else if (info !== undefined) {
                out[channelId] = String(info);
            }
        }
        return out;
    }

    _saveTickets() {
        const prepared = {};
        for (const [channelId, info] of Object.entries(this._tickets)) {
            if (info && typeof info === 'object') {
                const copy    = { ...info };
                const ownerId = this.extractOwnerId(copy);
                if (ownerId !== null) copy.owner = ownerId;
                else delete copy.owner;
                if (copy.close_message_id != null)
                    copy.close_message_id = String(copy.close_message_id);
                else
                    delete copy.close_message_id;
                prepared[channelId] = copy;
            } else {
                prepared[channelId] = String(info);
            }
        }
        // Keep Discord snowflake IDs as unquoted numbers in the JSON file
        const jsonString = JSON.stringify(prepared, null, 2)
            .replace(/"owner": "(\d+)"/g,            '"owner": $1')
            .replace(/"close_message_id": "(\d+)"/g, '"close_message_id": $1');

        fs.mkdirSync(path.dirname(PATHS.TICKET_JSON), { recursive: true });
        fs.writeFileSync(PATHS.TICKET_JSON, jsonString, 'utf8');
    }
}

module.exports = new TicketStore();
