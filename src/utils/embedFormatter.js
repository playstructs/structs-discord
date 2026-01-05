/**
 * Enhanced Embed Formatter
 * @module utils/embedFormatter
 * @description Utilities for creating visually enhanced Discord embeds using SUI design system
 */

const { EmbedBuilder } = require('discord.js');
const { 
    EMBED_COLORS, 
    formatNumber, 
    createProgressBar, 
    createSeparator,
    formatResource,
    createBadge,
    formatPercentage,
    createCodeBlock,
    truncate
} = require('./designSystem');

/**
 * Create an enhanced embed with SUI styling
 * @param {Object} options - Embed options
 * @returns {EmbedBuilder} Discord embed
 */
function createEnhancedEmbed(options = {}) {
    const {
        title,
        description,
        color = EMBED_COLORS.primary,
        fields = [],
        thumbnail,
        image,
        footer,
        timestamp = true
    } = options;

    const embed = new EmbedBuilder()
        .setColor(color);

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);
    if (footer) embed.setFooter({ text: footer });
    if (timestamp) embed.setTimestamp();

    // Add fields
    fields.forEach(field => {
        if (field.name && field.value) {
            embed.addFields(field);
        }
    });

    return embed;
}

/**
 * Format leaderboard data into an enhanced embed
 * @param {Object} options - Leaderboard options
 * @returns {EmbedBuilder} Discord embed
 */
function createLeaderboardEmbed(options) {
    const {
        title,
        orderBy,
        items = [],
        formatItem,
        topCount = 3
    } = options;

    const embed = createEnhancedEmbed({
        title: `🏆 ${title}`,
        color: EMBED_COLORS.primary,
        timestamp: true
    });

    if (items.length === 0) {
        embed.setDescription('No results found.');
        return embed;
    }

    // Build description with enhanced formatting
    let description = `**Ranked by:** ${orderBy.replace(/_/g, ' ')}\n`;
    description += `${createSeparator('─', 40)}\n\n`;

    items.forEach((item, index) => {
        const rank = index + 1;
        const isTopThree = rank <= topCount;
        const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        
        // Highlight top 3
        const rankPrefix = isTopThree ? `**${rankEmoji}**` : `${rankEmoji}`;
        
        if (formatItem) {
            description += `${rankPrefix} ${formatItem(item, rank)}\n\n`;
        } else {
            description += `${rankPrefix} ${JSON.stringify(item)}\n\n`;
        }
    });

    embed.setDescription(description);
    return embed;
}

/**
 * Create a resource field with progress bar
 * @param {string} name - Field name
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @param {Object} options - Options
 * @returns {Object} Discord embed field
 */
function createResourceField(name, current, max, options = {}) {
    const {
        unit = '',
        showProgressBar = true,
        showPercentage = true,
        inline = true
    } = options;

    let value = formatNumber(current, { suffix: unit });
    if (max > 0) {
        value += ` / ${formatNumber(max, { suffix: unit })}`;
        if (showPercentage) {
            const percentage = ((current / max) * 100).toFixed(1);
            value += ` (${percentage}%)`;
        }
    }

    if (showProgressBar && max > 0) {
        const bar = createProgressBar(current, max, 15, { 
            showPercentage: false,
            showValues: false
        });
        value += `\n${bar}`;
    }

    return {
        name,
        value,
        inline
    };
}

/**
 * Create a status field with badge
 * @param {string} name - Field name
 * @param {string} status - Status text
 * @param {string} type - Badge type
 * @param {boolean} inline - Inline field
 * @returns {Object} Discord embed field
 */
function createStatusField(name, status, type = 'info', inline = true) {
    return {
        name,
        value: createBadge(status, type),
        inline
    };
}

/**
 * Create a section separator field
 * @returns {Object} Discord embed field
 */
function createSeparatorField() {
    return {
        name: '\u200b',
        value: '\u200b',
        inline: false
    };
}

/**
 * Format entity data into card-like structure
 * @param {Object} data - Entity data
 * @param {Object} config - Configuration
 * @returns {Array} Array of embed fields
 */
function createEntityCard(data, config = {}) {
    const {
        title,
        fields = [],
        sections = []
    } = config;

    const cardFields = [];

    // Add title if provided
    if (title) {
        cardFields.push({
            name: title,
            value: createSeparator('─', 30),
            inline: false
        });
    }

    // Add configured fields
    fields.forEach(fieldConfig => {
        const { key, label, format, type, options = {} } = fieldConfig;
        const value = data[key];

        if (value === null || value === undefined) {
            if (options.showIfNull !== false) {
                cardFields.push({
                    name: label || key,
                    value: 'N/A',
                    inline: options.inline !== false
                });
            }
            return;
        }

        let formattedValue;
        if (format === 'number') {
            formattedValue = formatNumber(value, options);
        } else if (format === 'resource') {
            formattedValue = formatResource(type || key, value, options);
        } else if (format === 'percentage') {
            formattedValue = formatPercentage(value, options.decimals);
            } else if (format === 'progress') {
                const maxValue = typeof options.max === 'function' ? options.max(data) : (options.max || 100);
                formattedValue = createProgressBar(value, maxValue, options.length || 20, options);
        } else if (format === 'badge') {
            formattedValue = createBadge(value, type || 'info');
        } else if (typeof format === 'function') {
            formattedValue = format(value, data);
        } else {
            formattedValue = String(value);
        }

        cardFields.push({
            name: label || key,
            value: formattedValue,
            inline: options.inline !== false
        });
    });

    // Add sections
    sections.forEach(section => {
        if (cardFields.length > 0) {
            cardFields.push(createSeparatorField());
        }

        cardFields.push({
            name: section.title,
            value: createSeparator('─', 20),
            inline: false
        });

        section.fields.forEach(fieldConfig => {
            const { key, label, format, type, options = {} } = fieldConfig;
            const value = data[key];

            if (value === null || value === undefined) {
                if (options.showIfNull !== false) {
                    cardFields.push({
                        name: label || key,
                        value: 'N/A',
                        inline: options.inline !== false
                    });
                }
                return;
            }

            let formattedValue;
            if (format === 'number') {
                formattedValue = formatNumber(value, options);
            } else if (format === 'resource') {
                formattedValue = formatResource(type || key, value, options);
            } else if (format === 'percentage') {
                formattedValue = formatPercentage(value, options.decimals);
            } else if (format === 'progress') {
                const maxValue = typeof options.max === 'function' ? options.max(data) : (options.max || 100);
                formattedValue = createProgressBar(value, maxValue, options.length || 20, options);
            } else if (format === 'badge') {
                formattedValue = createBadge(value, type || 'info');
            } else if (typeof format === 'function') {
                formattedValue = format(value, data);
            } else {
                formattedValue = String(value);
            }

            cardFields.push({
                name: label || key,
                value: formattedValue,
                inline: options.inline !== false
            });
        });
    });

    return cardFields;
}

/**
 * Format a list of items into a code block
 * @param {Array} items - Items to format
 * @param {Function} formatter - Formatter function
 * @returns {string} Formatted code block
 */
function formatList(items, formatter) {
    if (!items || items.length === 0) return 'None';
    
    const lines = items.map((item, index) => {
        if (formatter) {
            return formatter(item, index);
        }
        return `${index + 1}. ${String(item)}`;
    });

    return createCodeBlock(lines.join('\n'));
}

module.exports = {
    createEnhancedEmbed,
    createLeaderboardEmbed,
    createResourceField,
    createStatusField,
    createSeparatorField,
    createEntityCard,
    formatList,
    EMBED_COLORS
};

