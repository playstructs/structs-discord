const { SlashCommandBuilder } = require('@discordjs/builders');
const { fetchPlayerData, fetchGuildData, fetchStructData } = require('../queries/structs');
const { createEmbeds } = require('../embeds/structs');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createWarningEmbed } = require('../utils/errors');

/**
 * Search command module
 * @module commands/search
 * @description Provides search functionality for players, guilds, structures, and addresses
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Get information about players, guilds, structs, and more')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('Search by: ID (e.g., 1-123), @username, guild name/tag, or address')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    /**
     * Autocomplete handler for search command
     * @param {Object} interaction - Discord autocomplete interaction
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getFocused - Get focused option value
     * @param {Function} interaction.respond - Respond with autocomplete choices
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const choices = [];
        
        try {
            // If the input is empty, return helpful default suggestions
            if (!focusedValue) {
                choices.push(
                    { name: '🔍 Search by player ID (e.g., 1-123)', value: '1-' },
                    { name: '🌍 Search by structure ID (e.g., 2-456)', value: '2-' },
                    { name: '👤 Search by @username', value: '@' },
                    { name: '🔒 Search by wallet address', value: 'structs' }
                );
            } else {
                // Use the simplified SQL query to get a unified list of searchable entities
                const result = await db.query(
                    `SELECT name, id FROM (
                        SELECT guild_meta.name, guild_meta.id FROM structs.guild_meta 
                        UNION 
                        SELECT guild_meta.tag, guild_meta.id FROM structs.guild_meta 
                        UNION 
                        SELECT '@' || player_discord.discord_username, player_discord.player_id FROM structs.player_discord 
                        UNION 
                        SELECT player_address.address, player_address.player_id FROM structs.player_address
                        UNION
                        SELECT trim($1,'%'), trim($1,'%')
                    ) 
                    WHERE name ILIKE $1
                    LIMIT 25`,
                    [`%${focusedValue}%`]
                );
                
                // Add visual indicators based on the type of entity
                result.rows.forEach(row => {
                    let name = row.name;
                    let prefix = '';
                    
                    // Add appropriate emoji based on the type of entity
                    if (row.id.startsWith('0-')) {
                        prefix = '🏰 '; // Guild
                    } else if (row.id.startsWith('1-')) {
                        prefix = '👤 '; // Player
                    } else if (row.id.startsWith('2-')) {
                        prefix = '🌍 '; // Planet
                    } else if (row.id.startsWith('3-')) {
                        prefix = '⚡ '; // Reactor
                    } else if (row.id.startsWith('4-')) {
                        prefix = '🔌 '; // Substation
                    } else if (row.id.startsWith('5-')) {
                        prefix = '🏗️ '; // Struct
                    } else if (row.id.startsWith('6-')) {
                        prefix = '📊 '; // Allocation
                    } else if (row.id.startsWith('9-')) {
                        prefix = '🚀 '; // Fleet
                    } else if (row.id.startsWith('10-')) {
                        prefix = '💡 '; // Provider
                    } else if (row.id.startsWith('11-')) {
                        prefix = '📝 '; // Agreement
                    } else if (name.startsWith('@')) {
                        prefix = '👤 '; // Discord user
                    } else if (name.startsWith('structs')) {
                        prefix = '🔒 '; // Wallet address
                    }
                    
                    choices.push({ name: prefix + name, value: row.id });
                });
                
                // If no results were found, add a helpful message
                if (choices.length === 0) {
                    choices.push({ 
                        name: `${EMOJIS.STATUS.WARNING} No results found. Try a different search term.`, 
                        value: 'no-results' 
                    });
                }
            }
            
            // Ensure we're responding with valid choices
            if (choices.length > 0) {
                await interaction.respond(choices);
            } else {
                // Fallback if somehow we have no choices
                await interaction.respond([
                    { name: `${EMOJIS.STATUS.WARNING} No results found`, value: 'no-results' }
                ]);
            }
        } catch (error) {
            console.error('Autocomplete error:', error);
            // Send a fallback response instead of an empty array
            await interaction.respond([
                { name: `${EMOJIS.STATUS.ERROR} Error occurred during search`, value: 'error' }
            ]);
        }
    },

    /**
     * Execute handler for search command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getString - Get string option value ('query')
     */
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const query = interaction.options.getString('query');
            let result;
            let playerId = null;

            // Check if it's a Discord mention
            if (query.startsWith('<@')) {
                const discordUsername = query.replace(/[<@!>]/g, '');
                const data = await fetchPlayerData.byDiscordUsername(discordUsername);
                if (data.rows && data.rows.length > 0) {
                    const embeds = await createEmbeds.player(data.rows[0]);
                    // Add search query to the first embed
                    embeds[0].setFooter({ text: `Search query: ${query}` });
                    playerId = data.rows[0].player_id;
                    
                    // Add inventory embed if it's a player
                    if (playerId) {
                        const inventoryEmbed = await createInventoryEmbed(playerId, data.rows[0].discord_username);
                        embeds.push(inventoryEmbed);
                    }
                    
                    return await interaction.editReply({ embeds });
                }
                return await interaction.editReply(`${EMOJIS.STATUS.ERROR} No player found with that Discord username. Try using their player ID or wallet address instead.`);
            }

            // Check if it's an ID in the format type-index
            if (query.includes('-')) {
                const [type, index] = query.split('-').map(Number);
                
                // Validate the ID format
                if (!isNaN(type) && !isNaN(index)) {
                    result = await handleIdLookup(query);
                    if (typeof result === 'string') {
                        return await interaction.editReply(result);
                    }
                    
                    // Add search query to the first embed
                    result.embeds[0].setFooter({ text: `Search query: ${query}` });
                    
                    // Check if it's a player and add inventory
                    if (query.startsWith('1-')) {
                        playerId = query;
                        const playerData = await fetchPlayerData.byId(playerId);
                        if (playerData.rows && playerData.rows.length > 0) {
                            const inventoryEmbed = await createInventoryEmbed(playerId, playerData.rows[0].discord_username);
                            result.embeds.push(inventoryEmbed);
                        }
                    }
                    
                    return await interaction.editReply(result);
                }
            }

            // Check if it's a guild name or tag
            const guildResult = await db.query(
                'SELECT id FROM structs.guild_meta WHERE tag = $1 OR name ILIKE $2',
                [query, `%${query}%`]
            );
            
            if (guildResult.rows.length > 0) {
                const guildId = guildResult.rows[0].id;
                const data = await fetchGuildData.byId(guildId);
                if (data.rows && data.rows.length > 0) {
                    const embeds = await createEmbeds.guild(data.rows[0]);
                    // Add search query to the first embed
                    embeds[0].setFooter({ text: `Search query: ${query}` });
                    return await interaction.editReply({ embeds });
                }
            }

            // Check if it's a player address
            const addressResult = await fetchPlayerData.byAddress(query);
            if (addressResult.rows && addressResult.rows.length > 0) {
                const embeds = await createEmbeds.player(addressResult.rows[0]);
                // Add search query to the first embed
                embeds[0].setFooter({ text: `Search query: ${query}` });
                playerId = addressResult.rows[0].player_id;
                
                // Add inventory embed if it's a player
                if (playerId) {
                    const inventoryEmbed = await createInventoryEmbed(playerId, addressResult.rows[0].discord_username);
                    embeds.push(inventoryEmbed);
                }
                
                return await interaction.editReply({ embeds });
            }

            // If we get here, nothing was found
            return await interaction.editReply({
                embeds: [createWarningEmbed(
                    'No Results Found',
                    'No information found for your query. Try a different search term or check the format of your input.'
                )]
            });
        } catch (error) {
            const { embed } = handleError(error, 'search command', interaction);
            return await interaction.editReply({ embeds: [embed] });
        }
    }
};

async function handleIdLookup(id) {
    // Parse the ID format (type-index)
    const [type, index] = id.split('-').map(Number);
    
    // Validate the ID format
    if (isNaN(type) || isNaN(index)) {
        return `${EMOJIS.STATUS.ERROR} Invalid ID format. Expected format: <type>-<index> (e.g., 1-123 for a player)`;
    }

    let data;
    let embeds;

    // Use the type to determine which query to run
    switch (type) {
        case 0: // Guild
            data = await fetchGuildData.byId(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.guild(data.rows[0]);
                return { embeds };
            }
            break;

        case 1: // Player
            data = await fetchPlayerData.byId(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.player(data.rows[0]);
                return { embeds };
            }
            break;

        case 2: // Planet
            data = await fetchStructData.planet(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.planet(data.rows[0]);
                return { embeds };
            }
            break;

        case 3: // Reactor
            data = await fetchStructData.reactor(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.reactor(data.rows[0]);
                return { embeds };
            }
            break;

        case 4: // Substation
            data = await fetchStructData.substation(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.substation(data.rows[0]);
                return { embeds };
            }
            break;

        case 5: // Struct
            data = await fetchStructData.struct(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.struct(data.rows[0]);
                return { embeds };
            }
            break;

        case 6: // Allocation
            data = await fetchStructData.allocation(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.allocation(data.rows[0]);
                return { embeds };
            }
            break;

        case 7: // Infusion
            data = await fetchStructData.infusion(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.infusion(data.rows[0]);
                return { embeds };
            }
            break;

        case 8: // Address
            // For address, the ID format is 8-0-addressstring or 8-index-addressstring
            // Extract the address from the ID format
            const addressParts = id.split('-');
            let addressString;
            if (addressParts.length >= 3) {
                // Format: 8-index-addressstring, extract everything after the second dash
                addressString = addressParts.slice(2).join('-');
            } else {
                // If it's just an address string, use it directly
                addressString = id;
            }
            data = await fetchStructData.address(addressString);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.address(data.rows[0]);
                return { embeds };
            }
            break;

        case 9: // Fleet
            data = await fetchStructData.fleet(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.fleet(data.rows[0]);
                return { embeds };
            }
            break;

        case 10: // Provider
            data = await fetchStructData.provider(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.provider(data.rows[0]);
                return { embeds };
            }
            break;

        case 11: // Agreement
            data = await fetchStructData.agreement(id);
            if (data.rows && data.rows.length > 0) {
                embeds = await createEmbeds.agreement(data.rows[0]);
                return { embeds };
            }
            break;

        default:
            return `${EMOJIS.STATUS.ERROR} Unknown entity type. Valid types are 0-11.`;
    }

    return `${EMOJIS.STATUS.ERROR} No information found for the specified ID.`;
}

// Helper function to create inventory embed
async function createInventoryEmbed(playerId, username) {
    try {
        // Fetch player inventory data
        const inventoryResult = await db.query(
            `WITH base AS (select
                sum(case
                        when ledger.direction = 'debit' then ledger.amount_p * -1
                        ELSE ledger.amount_p END) as hard_balance,
                denom                             as denom
            from structs.ledger,
                structs.player_address
            WHERE
                player_address.address = ledger.address
                and player_address.player_id = $1
            GROUP BY ledger.denom
            ), expanded as (
            SELECT
            base.hard_balance  as token_amount,
            CASE denom WHEN 'ualpha' THEN base.hard_balance WHEN 'ore' THEN 0 ELSE (SELECT guild_bank.ratio * base.hard_balance FROM view.guild_bank where guild_bank.denom = base.denom) END as alpha_value,
            denom
            FROM base
            )
            select
                expanded.token_amount,
                structs.UNIT_DISPLAY_FORMAT(expanded.token_amount, denom) as display_token_amount,
                expanded.alpha_value,
                structs.UNIT_DISPLAY_FORMAT(expanded.alpha_value, 'ualpha') as display_alpha_value,
                denom
            from
                expanded;`,
            [playerId]
        );
        
        // Create inventory embed
        const inventoryEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Inventory for ${username} (${playerId})`)
            .setDescription('Player inventory and token balances')
            .setTimestamp()
            .setFooter({ text: 'Structs Discord Bot' });
        
        // Add inventory items to the embed
        if (inventoryResult.rows.length === 0) {
            inventoryEmbed.addFields({ name: 'No Inventory', value: 'This player has no inventory items.' });
        } else {
            
            // Add each token to the embed
            inventoryResult.rows.forEach(row => {
                if (row.token_amount !== 0) {
                    inventoryEmbed.addFields({ 
                        name: `${row.display_token_amount}`, 
                        value: `(${row.token_amount} ${row.denom})`,
                        inline: false 
                    });
                }
            });
        }
        
        return inventoryEmbed;
    } catch (error) {
        console.error('Error creating inventory embed:', error);
        return null;
    }
} 