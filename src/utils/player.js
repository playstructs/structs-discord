const db = require('../database');

/**
 * Get player ID from Discord ID
 * @param {string} discordId - Discord user ID
 * @returns {Promise<string|null>} Player ID or null if not found
 */
async function getPlayerId(discordId) {
    try {
        const result = await db.query(
            'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
            [discordId]
        );
        return result.rows.length > 0 ? result.rows[0].player_id : null;
    } catch (error) {
        console.error('Error getting player ID:', error);
        return null;
    }
}

/**
 * Get player ID and additional player data from Discord ID
 * @param {string} discordId - Discord user ID
 * @returns {Promise<Object|null>} Player data object or null if not found
 */
async function getPlayerData(discordId) {
    try {
        const result = await db.query(
            'SELECT player_discord.player_id, player.fleet_id, player.planet_id FROM structs.player_discord, structs.player WHERE player_discord.player_id=player.id AND player_discord.discord_id = $1',
            [discordId]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error('Error getting player data:', error);
        return null;
    }
}

module.exports = {
    getPlayerId,
    getPlayerData
};

