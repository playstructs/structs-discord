/**
 * Structs UI (SUI) Design System
 * @module utils/designSystem
 * @description Design system constants and utilities matching structs-webapp SUI
 * 
 * Based on: .agents/repositories/structs-webapp/src/public/css/sui/sui.css
 */

/**
 * SUI Color Palette
 * Extracted from structs-webapp CSS variables
 */
const COLORS = {
    // Accent Colors
    accentPrimary: '#43CDB6',           // Primary teal/cyan
    accentPrimaryActive: '#C2EFDD',     // Light teal
    accentSecondary: '#94A4E4',          // Purple/blue
    accentSecondaryActive: '#BBCAEF',   // Light purple
    accentDestructive: '#EE7D69',       // Red/orange
    accentDestructiveActive: '#F4A990',  // Light red
    accentDisabled: '#7394A5',           // Gray-blue
    
    // Border Colors
    border: '#5D7E90',                   // Blue-gray
    borderStrong: '#A7C0C6',             // Light blue-gray
    borderSubtle: '#394958',              // Dark blue-gray
    borderEnemy: '#440D3A',              // Dark purple
    borderPlayer: '#133546',              // Dark teal
    
    // Background Colors
    pageBackground: '#1A2029',           // Dark blue-gray
    surfaceDefault: '#222034',           // Dark purple-gray (for cards/panels)
    surfacePanel: '#5D7E90',             // Blue-gray
    surfacePlayerBody: '#133546',        // Dark teal
    surfaceEnemyBody: '#2E1F3E',         // Dark purple
    
    // Text Colors
    textBody: '#C5D7D9',                 // Light gray (primary text)
    textHint: '#A7C0C6',                  // Medium gray (hints)
    textPlayerPrimary: '#43CDB6',          // Teal
    textPlayerHighlight: '#86DFC6',       // Light teal
    textWarning: '#F3C878',               // Yellow
    textEnemyPrimary: '#EE7D69',          // Red/orange
    
    // Icon Colors
    iconPrimary: '#43CDB6',               // Teal
    iconDestructive: '#EE7D69',           // Red/orange
    iconWarning: '#F3C878',               // Yellow
    iconDark: '#394958'                   // Dark gray
};

/**
 * SUI Spacing System
 * Extracted from structs-webapp CSS variables
 */
const SPACING = {
    xs: 2,    // 2px
    sm: 4,    // 4px
    md: 8,    // 8px
    lg: 12,   // 12px
    xl: 16,   // 16px
    xxl: 24,  // 24px
    xxxl: 32  // 32px
};

/**
 * Discord Embed Color Mapping
 * Maps SUI colors to Discord embed colors (hex to decimal)
 */
const EMBED_COLORS = {
    primary: parseInt(COLORS.accentPrimary.replace('#', ''), 16),      // #43CDB6
    secondary: parseInt(COLORS.accentSecondary.replace('#', ''), 16),  // #94A4E4
    success: parseInt(COLORS.accentPrimary.replace('#', ''), 16),       // #43CDB6
    warning: parseInt(COLORS.textWarning.replace('#', ''), 16),        // #F3C878
    error: parseInt(COLORS.accentDestructive.replace('#', ''), 16),    // #EE7D69
    default: parseInt(COLORS.border.replace('#', ''), 16)              // #5D7E90
};

/**
 * Format a number with SUI styling
 * @param {number} value - The number to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted number string
 */
function formatNumber(value, options = {}) {
    const {
        decimals = 0,
        suffix = '',
        prefix = '',
        showSign = false
    } = options;
    
    if (value === null || value === undefined) return 'N/A';
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    
    let formatted = num.toFixed(decimals);
    
    // Add thousand separators
    if (decimals === 0) {
        formatted = num.toLocaleString('en-US');
    } else {
        formatted = num.toLocaleString('en-US', { 
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals 
        });
    }
    
    if (showSign && num > 0) {
        formatted = `+${formatted}`;
    }
    
    return `${prefix}${formatted}${suffix}`;
}

/**
 * Create a progress bar using Unicode characters
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @param {number} length - Bar length in characters
 * @param {Object} options - Options
 * @returns {string} Progress bar string
 */
function createProgressBar(current, max, length = 20, options = {}) {
    const {
        filledChar = '█',
        emptyChar = '░',
        showPercentage = true,
        showValues = false
    } = options;
    
    if (max === 0) return `${emptyChar.repeat(length)} 0%`;
    
    const percentage = Math.min(100, Math.max(0, (current / max) * 100));
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    
    let bar = `${filledChar.repeat(filled)}${emptyChar.repeat(empty)}`;
    
    if (showPercentage) {
        bar += ` ${percentage.toFixed(1)}%`;
    }
    
    if (showValues) {
        bar += ` (${formatNumber(current)}/${formatNumber(max)})`;
    }
    
    return bar;
}

/**
 * Create a visual separator for Discord embeds
 * @param {string} char - Character to use for separator
 * @param {number} length - Length of separator
 * @returns {string} Separator string
 */
function createSeparator(char = '─', length = 30) {
    return char.repeat(length);
}

/**
 * Format a resource value with icon emoji
 * @param {string} resourceType - Type of resource (alpha, energy, ore, etc.)
 * @param {number|string} value - Resource value
 * @param {Object} options - Formatting options
 * @returns {string} Formatted resource string
 */
function formatResource(resourceType, value, options = {}) {
    const icons = {
        alpha: '⚡',
        energy: '🔋',
        ore: '💎',
        capacity: '📊',
        load: '⚙️',
        fuel: '⛽',
        power: '⚡'
    };
    
    const icon = icons[resourceType.toLowerCase()] || '•';
    const formatted = formatNumber(value, options);
    
    return `${icon} ${formatted}`;
}

/**
 * Create a status badge string
 * @param {string} status - Status text
 * @param {string} type - Badge type (success, warning, error, info)
 * @returns {string} Badge string
 */
function createBadge(status, type = 'info') {
    const badges = {
        success: '✅',
        warning: '⚠️',
        error: '❌',
        info: 'ℹ️',
        active: '🟢',
        inactive: '🔴',
        pending: '🟡'
    };
    
    const icon = badges[type] || badges.info;
    return `${icon} ${status}`;
}

/**
 * Format a percentage value
 * @param {number} value - Percentage value (0-100)
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted percentage
 */
function formatPercentage(value, decimals = 1) {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(decimals)}%`;
}

/**
 * Create a code block with formatted data
 * @param {string} content - Content to put in code block
 * @param {string} language - Code block language (optional)
 * @returns {string} Code block string
 */
function createCodeBlock(content, language = '') {
    return `\`\`\`${language}\n${content}\n\`\`\``;
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add when truncated
 * @returns {string} Truncated text
 */
function truncate(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength - suffix.length) + suffix;
}

module.exports = {
    COLORS,
    SPACING,
    EMBED_COLORS,
    formatNumber,
    createProgressBar,
    createSeparator,
    formatResource,
    createBadge,
    formatPercentage,
    createCodeBlock,
    truncate
};

