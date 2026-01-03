const { EMOJIS } = require('../constants/emojis');
const { EmbedBuilder } = require('discord.js');

/**
 * Standard error handler for Discord commands
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred (e.g., 'struct command')
 * @param {Object} interaction - Discord interaction object (optional)
 * @returns {Object} Error embed and log message
 */
function handleError(error, context = 'command', interaction = null) {
    // Log the error
    console.error(`Error in ${context}:`, error);
    
    // Create user-friendly error message
    const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000) // Red
        .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
        .setDescription('An error occurred while processing your request.')
        .addFields(
            { name: 'Context', value: context, inline: true }
        )
        .setTimestamp();

    // Add more details if it's a known error type
    if (error.message) {
        // Check for common database errors
        if (error.message.includes('violates foreign key constraint')) {
            errorEmbed.setDescription('The requested resource does not exist or is invalid.');
        } else if (error.message.includes('duplicate key')) {
            errorEmbed.setDescription('This resource already exists.');
        } else if (error.message.includes('permission denied')) {
            errorEmbed.setDescription('You do not have permission to perform this action.');
        } else if (error.message.includes('not found')) {
            errorEmbed.setDescription('The requested resource was not found.');
        } else if (error.message.includes('invalid input')) {
            errorEmbed.setDescription('The provided input is invalid. Please check your parameters.');
        } else {
            // For development, include error message (remove in production)
            if (process.env.NODE_ENV === 'development') {
                errorEmbed.addFields({ name: 'Details', value: error.message.substring(0, 1000), inline: false });
            }
        }
    }

    return {
        embed: errorEmbed,
        logMessage: `Error in ${context}: ${error.message || error}`
    };
}

/**
 * Create a success embed
 * @param {string} title - Title of the success message
 * @param {string} description - Description of the success
 * @param {Array} fields - Additional fields to add
 * @returns {EmbedBuilder} Success embed
 */
function createSuccessEmbed(title, description, fields = []) {
    const embed = new EmbedBuilder()
        .setColor(0x00ff00) // Green
        .setTitle(`${EMOJIS.STATUS.SUCCESS} ${title}`)
        .setDescription(description)
        .setTimestamp();

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    return embed;
}

/**
 * Create a warning embed
 * @param {string} title - Title of the warning message
 * @param {string} description - Description of the warning
 * @param {Array} fields - Additional fields to add
 * @returns {EmbedBuilder} Warning embed
 */
function createWarningEmbed(title, description, fields = []) {
    const embed = new EmbedBuilder()
        .setColor(0xffaa00) // Orange/Yellow
        .setTitle(`${EMOJIS.STATUS.WARNING} ${title}`)
        .setDescription(description)
        .setTimestamp();

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    return embed;
}

/**
 * Create an info embed
 * @param {string} title - Title of the info message
 * @param {string} description - Description of the info
 * @param {Array} fields - Additional fields to add
 * @returns {EmbedBuilder} Info embed
 */
function createInfoEmbed(title, description, fields = []) {
    const embed = new EmbedBuilder()
        .setColor(0x0099ff) // Blue
        .setTitle(`${EMOJIS.STATUS.INFO} ${title}`)
        .setDescription(description)
        .setTimestamp();

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    return embed;
}

/**
 * Validate player registration
 * @param {Object} playerResult - Database query result for player
 * @param {string} customMessage - Custom error message (optional)
 * @returns {Object|null} Error embed if not registered, null if registered
 */
function validatePlayerRegistration(playerResult, customMessage = null) {
    if (!playerResult || playerResult.rows.length === 0) {
        return createWarningEmbed(
            'Not Registered',
            customMessage || 'You are not registered as a player. Please use `/join` to join a guild and create an account.'
        );
    }
    return null;
}

/**
 * Validate required parameter
 * @param {any} value - Value to validate
 * @param {string} paramName - Name of the parameter
 * @returns {Object|null} Error embed if invalid, null if valid
 */
function validateRequiredParam(value, paramName) {
    if (value === null || value === undefined || value === '') {
        return createWarningEmbed(
            'Missing Parameter',
            `The ${paramName} parameter is required but was not provided.`
        );
    }
    return null;
}

module.exports = {
    handleError,
    createSuccessEmbed,
    createWarningEmbed,
    createInfoEmbed,
    validatePlayerRegistration,
    validateRequiredParam
};

