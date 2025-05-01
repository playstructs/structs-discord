const { EMOJIS } = require('../constants/emojis');
const { query } = require('../database');

/**
 * Formats an amount with its appropriate unit based on the denomination
 * @param {number} amount - The amount to format
 * @param {string} denom - The denomination (e.g., 'ualpha', 'uguild.123', 'milliwatt', 'ore')
 * @param {Object} [guildMeta] - Optional guild metadata for guild token formatting
 * @returns {string} Formatted amount with unit
 */
async function formatUnit(amount, denom, guildMeta = null) {
    let formatAmount;
    let formatExp;
    let formatPostfix;
    let currentLength;

    if (denom === 'ualpha') {
        currentLength = Math.floor(amount).toString().length;

        formatExp = (() => {
            if (currentLength >= 16) return 18;      // 'talpha' Tergram
            if (currentLength >= 10) return 9;       // 'kalpha' Kilogram
            if (currentLength >= 6) return 6;        // 'alpha' gram
            if (currentLength >= 3) return 3;        // 'malpha' milligram
            return 0;                                // 'ualpha' microgram
        })();

        formatPostfix = (() => {
            switch (formatExp) {
                case 18: return 'Tg';
                case 9: return 'Kg';
                case 6: return 'g';
                case 3: return 'mg';
                case 0: return 'μg';
                default: return '';
            }
        })();

        formatAmount = `${EMOJIS.CURRENCY.ALPHA} ${(amount / Math.pow(10, formatExp)).toFixed(2)}${formatPostfix}`;
    } else if (denom.startsWith('uguild')) {
        currentLength = Math.floor(amount).toString().length;

        const guildId = denom.replace('uguild.', '');
        const guildMeta = await query("SELECT guild_meta.denom->>'0' as small_denom, guild_meta.denom->>'6' as big_denom FROM structs.guild_meta WHERE id = $1", [guildId]);
        const formatTokenSmall = guildMeta.rows[0]?.small_denom || null;
        const formatTokenBig = guildMeta.rows[0]?.big_denom || null;

        formatExp = currentLength >= 6 ? 6 : 0;  // 6 for guild., 0 for uguild.

        formatPostfix = (() => {
            if (formatExp === 6) {
                return formatTokenBig || denom.substring(1);
            }
            return formatTokenSmall || denom;
        })();

        formatAmount = `${(amount / Math.pow(10, formatExp)).toFixed(2)}${formatPostfix}`;
    } else if (denom === 'milliwatt') {
        currentLength = Math.floor(amount).toString().length;

        formatExp = (() => {
            if (currentLength >= 16) return 18;      // terawatt
            if (currentLength >= 10) return 9;       // megawatt
            if (currentLength >= 6) return 6;        // kilowatt
            if (currentLength >= 3) return 3;        // watt
            return 0;                                // milliwatt
        })();

        formatPostfix = (() => {
            switch (formatExp) {
                case 18: return 'TW';
                case 9: return 'MW';
                case 6: return 'KW';
                case 3: return 'W';
                case 0: return 'mW';
                default: return '';
            }
        })();

        formatAmount = `${EMOJIS.CURRENCY.ENERGY} ${(amount / Math.pow(10, formatExp)).toFixed(2)}${formatPostfix}`;
    } else if (denom === 'ore') {
        currentLength = Math.floor(amount).toString().length;

        formatExp = (() => {
            if (currentLength >= 12) return 18;      // teragram
            if (currentLength >= 4) return 3;        // kilogram
            return 0;                                // gram
        })();

        formatPostfix = (() => {
            switch (formatExp) {
                case 18: return 'Tg';
                case 3: return 'Kg';
                case 0: return 'g';
                default: return '';
            }
        })();

        formatAmount = `${EMOJIS.CURRENCY.ORE} ${(amount / Math.pow(10, formatExp)).toFixed(2)}${formatPostfix}`;
    }

    return formatAmount;
}

module.exports = { formatUnit }; 