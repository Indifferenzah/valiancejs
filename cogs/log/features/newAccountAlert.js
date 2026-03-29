'use strict';

const NEW_ACCOUNT_DAYS = 7;

/**
 * Feature 15: New Account Alert
 * Controlla se un account Discord è nuovo (< 7 giorni)
 */

/**
 * @param {GuildMember} member
 * @returns {{ isNew: boolean, ageDays: number }}
 */
function checkNewAccount(member) {
    const createdAt = member.user.createdTimestamp;
    const ageMs = Date.now() - createdAt;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const isNew = ageDays < NEW_ACCOUNT_DAYS;
    return { isNew, ageDays };
}

/**
 * Restituisce il colore per l'embed in base all'età dell'account
 * @param {boolean} isNew
 * @param {number} ageDays
 * @returns {string} colore hex
 */
function getAccountColor(isNew, ageDays) {
    if (!isNew) return '#43B581'; // verde
    if (ageDays <= 1) return '#FF0000'; // rosso acceso - account di poche ore
    return '#FF6B35'; // arancione - account giovane
}

/**
 * Restituisce un field da aggiungere all'embed di join
 * @param {boolean} isNew
 * @param {number} ageDays
 * @returns {object|null}
 */
function getAlertField(isNew, ageDays) {
    if (!isNew) return null;
    return {
        name: '⚠️ Account Nuovo',
        value: ageDays === 0
            ? '**Account creato OGGI! Possibile account fake.**'
            : `**Account creato solo ${ageDays} giorn${ageDays === 1 ? 'o' : 'i'} fa. Potrebbe essere sospetto.**`,
        inline: false
    };
}

module.exports = { checkNewAccount, getAccountColor, getAlertField };
