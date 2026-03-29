'use strict';

/**
 * Feature 16: Rate Limiter
 * Aggrega eventi rapidi per evitare spam di embed nel canale di log
 */

// Map<key, { count, firstAt, lastAt, events: [] }>
const buckets = new Map();

/**
 * Traccia un evento. Ritorna { limited: bool, count: number }
 * @param {string} key - chiave unica (es. `messageDelete:guildId:channelId`)
 * @param {number} windowMs - finestra temporale in ms
 * @param {number} limit - soglia per il rate limiting
 * @param {any} [eventData] - dati opzionali da accumulare
 */
function track(key, windowMs, limit, eventData = null) {
    const now = Date.now();

    if (!buckets.has(key)) {
        buckets.set(key, {
            count: 1,
            firstAt: now,
            lastAt: now,
            windowMs,
            events: eventData !== null ? [eventData] : []
        });
        return { limited: false, count: 1 };
    }

    const bucket = buckets.get(key);

    // Resetta se la finestra è scaduta
    if (now - bucket.firstAt > windowMs) {
        bucket.count = 1;
        bucket.firstAt = now;
        bucket.lastAt = now;
        bucket.events = eventData !== null ? [eventData] : [];
        return { limited: false, count: 1 };
    }

    bucket.count++;
    bucket.lastAt = now;
    if (eventData !== null) {
        bucket.events.push(eventData);
    }

    const limited = bucket.count >= limit;
    return { limited, count: bucket.count };
}

/**
 * Ottiene tutti gli eventi in coda per una chiave
 * @param {string} key
 * @returns {any[]}
 */
function getBundled(key) {
    const bucket = buckets.get(key);
    if (!bucket) return [];
    return bucket.events || [];
}

/**
 * Svuota la coda per una chiave dopo l'invio dell'embed raggruppato
 * @param {string} key
 */
function flush(key) {
    buckets.delete(key);
}

/**
 * Pulisce bucket scaduti (chiamare periodicamente)
 */
function cleanExpired() {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
        if (now - bucket.firstAt > bucket.windowMs * 2) {
            buckets.delete(key);
        }
    }
}

// Pulizia automatica ogni 5 minuti
setInterval(cleanExpired, 5 * 60 * 1000).unref();

module.exports = { track, getBundled, flush, cleanExpired };
