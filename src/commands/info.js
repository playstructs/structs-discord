const { SlashCommandBuilder } = require('@discordjs/builders');
const { fetchPlayerData, fetchGuildData, fetchStructData } = require('../queries/structs');
const { createEmbeds } = require('../embeds/structs');
const db = require('../database');

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
                    ) AS searchable_entities
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
            }
            
            await interaction.respond(choices);
        } catch (error) {
            console.error('Autocomplete error:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const query = interaction.options.getString('query');
            let result;

            // Check if it's a Discord mention
            if (query.startsWith('<@')) {
                const discordId = query.replace(/[<@!>]/g, '');
                const data = await fetchPlayerData.byDiscordId(discordId);
                if (data.rows && data.rows.length > 0) {
                    const embeds = await createEmbeds.player(data.rows[0]);
                    return await interaction.editReply({ embeds });
                }
                return await interaction.editReply('❌ No player found with that Discord username. Try using their player ID or wallet address instead.');
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
                    return await interaction.editReply({ embeds });
                }
            }

            // Check if it's a player address
            const addressResult = await fetchPlayerData.byAddress(query);
            if (addressResult.rows && addressResult.rows.length > 0) {
                const embeds = await createEmbeds.player(addressResult.rows[0]);
                return await interaction.editReply({ embeds });
            }

            // If we get here, nothing was found
            return await interaction.editReply('❌ No information found for your query. Try a different search term or check the format of your input.');
        } catch (error) {
            console.error(error);
            return await interaction.editReply('❌ There was an error processing your request. Please try again later.');
        }
    }
};

async function handleIdLookup(id) {
    // Parse the ID format (type-index)
    const [type, index] = id.split('-').map(Number);
    
    // Validate the ID format
    if (isNaN(type) || isNaN(index)) {
        return '❌ Invalid ID format. Expected format: <type>-<index> (e.g., 1-123 for a player)';
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
            return '❌ Infusion lookup not implemented yet.';
            break;

        case 8: // Address
            return '❌ Address lookup not implemented yet.';
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
            return '❌ Invalid type in ID. Type must be between 0 and 11.';
    }

    return '❌ No entity found with that ID.';
} 