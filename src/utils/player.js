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

/**
 * Get player ID with validation - returns error embed if not registered
 * @param {string} discordId - Discord user ID
 * @param {string} customMessage - Custom error message (optional)
 * @returns {Promise<{playerId: string}|{error: EmbedBuilder}>} Player ID object or error embed
 */
async function getPlayerIdWithValidation(discordId, customMessage = null) {
    const { createWarningEmbed } = require('./errors');
    const playerId = await getPlayerId(discordId);
    
    if (!playerId) {
        return {
            error: createWarningEmbed(
                'Not Registered',
                customMessage || 'You are not registered as a player. Please use `/join` to join a guild first.'
            )
        };
    }
    
    return { playerId };
}

/**
 * Get player ID from wallet address
 * @param {string} address - Wallet address
 * @returns {Promise<string|null>} Player ID or null if not found
 */
async function getPlayerIdFromAddress(address) {
    try {
        const result = await db.query(
            'SELECT player_id FROM structs.player_address WHERE address = $1 LIMIT 1',
            [address]
        );
        return result.rows.length > 0 ? result.rows[0].player_id : null;
    } catch (error) {
        console.error('Error getting player ID from address:', error);
        return null;
    }
}

/**
 * Get Discord username from player ID
 * @param {string} playerId - Player ID
 * @returns {Promise<string|null>} Discord username or null if not found
 */
async function getDiscordUsername(playerId) {
    try {
        const result = await db.query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [playerId]
        );
        return result.rows.length > 0 ? result.rows[0].discord_username : null;
    } catch (error) {
        console.error('Error getting Discord username:', error);
        return null;
    }
}

/**
 * Get player ID from Discord username
 * @param {string} discordUsername - Discord username
 * @returns {Promise<string|null>} Player ID or null if not found
 */
async function getPlayerIdFromUsername(discordUsername) {
    try {
        const result = await db.query(
            'SELECT player_id FROM structs.player_discord WHERE discord_username = $1',
            [discordUsername]
        );
        return result.rows.length > 0 ? result.rows[0].player_id : null;
    } catch (error) {
        console.error('Error getting player ID from username:', error);
        return null;
    }
}

module.exports = {
    getPlayerId,
    getPlayerData,
    getPlayerIdWithValidation,
    getPlayerIdFromAddress,
    getDiscordUsername,
    getPlayerIdFromUsername
};

