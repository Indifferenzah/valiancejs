'use strict';

/**
 * Feature 10: Edit Diff
 * Calcola la differenza tra due testi e la formatta con markdown Discord
 */

/**
 * Computa la differenza tra due testi.
 * Parole rimosse: ~~crossed~~, parole aggiunte: **bold**
 * @param {string} oldText
 * @param {string} newText
 * @returns {string} stringa formattata max 1024 caratteri
 */
function computeDiff(oldText, newText) {
    if (!oldText && !newText) return '*nessun contenuto*';
    if (!oldText) return newText || '*nessun contenuto*';
    if (!newText) return `~~${oldText}~~`;
    if (oldText === newText) return newText;

    const oldWords = oldText.split(/(\s+)/);
    const newWords = newText.split(/(\s+)/);

    const result = lcs(oldWords, newWords);
    let formatted = '';

    let i = 0, j = 0;
    for (const match of result) {
        // Parole rimosse (in old ma non nel match)
        while (i < match.oldIdx) {
            const word = oldWords[i];
            if (word.trim()) {
                formatted += `~~${word}~~`;
            } else {
                formatted += word; // Spazi
            }
            i++;
        }
        // Parole aggiunte (in new ma non nel match)
        while (j < match.newIdx) {
            const word = newWords[j];
            if (word.trim()) {
                formatted += `**${word}**`;
            } else {
                formatted += word;
            }
            j++;
        }
        // Parola in comune
        formatted += oldWords[match.oldIdx];
        i = match.oldIdx + 1;
        j = match.newIdx + 1;
    }

    // Residui dopo l'ultimo match
    while (i < oldWords.length) {
        const word = oldWords[i];
        if (word.trim()) {
            formatted += `~~${word}~~`;
        } else {
            formatted += word;
        }
        i++;
    }
    while (j < newWords.length) {
        const word = newWords[j];
        if (word.trim()) {
            formatted += `**${word}**`;
        } else {
            formatted += word;
        }
        j++;
    }

    // Tronca a 1024 caratteri
    if (formatted.length > 1024) {
        formatted = formatted.substring(0, 1021) + '...';
    }

    return formatted || '*nessun contenuto*';
}

/**
 * LCS semplificato per trovare le parole comuni tra due array.
 * Restituisce array di { oldIdx, newIdx }
 */
function lcs(a, b) {
    // Limite per performance: se troppo lungo, usa diff semplificato
    if (a.length > 200 || b.length > 200) {
        return simpleDiff(a, b);
    }

    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Tracciamento back
    const matches = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) {
            matches.unshift({ oldIdx: i - 1, newIdx: j - 1 });
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }

    return matches;
}

/**
 * Diff semplificato per testi lunghi: trova solo le parole uguali in posizione
 */
function simpleDiff(a, b) {
    const matches = [];
    const setA = new Set(a);
    let j = 0;
    for (let i = 0; i < a.length && j < b.length; i++) {
        if (a[i] === b[j] && a[i].trim()) {
            matches.push({ oldIdx: i, newIdx: j });
            j++;
        }
    }
    return matches;
}

module.exports = { computeDiff };
