const { EMOJIS } = require('../constants/emojis');

/**
 * Format a struct choice for autocomplete display
 * @param {Object} row - Database row with struct data
 * @param {string} row.name - Struct name (id + type)
 * @param {number} row.ambit - Operating ambit value
 * @param {string} row.icon - Icon key for emoji lookup
 * @param {string} row.value - Struct ID value
 * @returns {Object} Formatted choice object for Discord autocomplete
 */
function formatStructChoice(row) {
    const typeEmojiKey = row.icon;
    const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
    
    const ambitEmojiKey = `RANGE_${row.ambit}`;
    const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
    
    return {
        name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
        value: row.value
    };
}

/**
 * Get struct attribute value from database
 * @param {string} structId - Struct ID
 * @param {string} attributeType - Attribute type (e.g., 'blockStartBuild')
 * @returns {Promise<number|null>} Attribute value or null if not found
 */
async function getStructAttribute(structId, attributeType) {
    const db = require('../database');
    try {
        const result = await db.query(
            'SELECT val FROM structs.struct_attribute WHERE object_id = $1 AND attribute_type = $2',
            [structId, attributeType]
        );
        return result.rows.length > 0 ? result.rows[0].val : null;
    } catch (error) {
        console.error(`Error getting struct attribute ${attributeType} for ${structId}:`, error);
        return null;
    }
}

module.exports = {
    formatStructChoice,
    getStructAttribute
};

