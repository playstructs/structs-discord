const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View a player\'s inventory')
        .addStringOption(option =>
            option
                .setName('player')
                .setDescription('Player ID or @mention')
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
                    { name: '🔍 Type to search for a player', value: 'search' }
                );
            } else {
                // Search for players by Discord username
                const playerResult = await db.query(
                    `SELECT '@' || discord_username AS name, player_id AS id 
                    FROM structs.player_discord 
                    WHERE discord_username ILIKE $1
                    LIMIT 10`,
                    [`%${focusedValue}%`]
                );
                
                // Search for players by wallet address
                const addressResult = await db.query(
                    `SELECT address AS name, player_id AS id 
                    FROM structs.player_address 
                    WHERE address ILIKE $1
                    LIMIT 10`,
                    [`%${focusedValue}%`]
                );
                
                // Search for players by ID
                const idResult = await db.query(
                    `SELECT player_id AS name, player_id AS id 
                    FROM structs.player_discord 
                    WHERE player_id ILIKE $1
                    LIMIT 10`,
                    [`%${focusedValue}%`]
                );
                
                // Combine all results
                const allResults = [
                    ...playerResult.rows.map(row => ({ ...row, type: 'player' })),
                    ...addressResult.rows.map(row => ({ ...row, type: 'address' })),
                    ...idResult.rows.map(row => ({ ...row, type: 'id' }))
                ];
                
                // Add visual indicators based on the type of entity
                allResults.forEach(row => {
                    let name = row.name;
                    let prefix = '';
                    
                    if (row.type === 'player') {
                        prefix = '👤 '; // Discord user
                    } else if (row.type === 'address') {
                        prefix = '🔒 '; // Wallet address
                    } else if (row.type === 'id') {
                        prefix = '🆔 '; // Player ID
                    }
                    
                    choices.push({ name: prefix + name, value: row.id });
                });
                
                // If no results were found, add a helpful message
                if (choices.length === 0) {
                    choices.push({ 
                        name: '🔍 No players found. Try a different search term.', 
                        value: 'no-results' 
                    });
                }
            }
            
            // Log the choices for debugging
            console.log(`Inventory autocomplete choices for "${focusedValue}":`, choices);
            
            // Ensure we're responding with valid choices
            if (choices.length > 0) {
                await interaction.respond(choices);
            } else {
                // Fallback if somehow we have no choices
                await interaction.respond([
                    { name: '🔍 No players found', value: 'no-results' }
                ]);
            }
        } catch (error) {
            console.error('Error in inventory autocomplete:', error);
            // Send a fallback response instead of an empty array
            await interaction.respond([
                { name: '❌ Error occurred during search', value: 'error' }
            ]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const playerIdentifier = interaction.options.getString('player');
            let playerId;

            // Check if it's a Discord mention
            if (playerIdentifier.startsWith('<@')) {
                const discordId = playerIdentifier.replace(/[<@!>]/g, '');
                const playerResult = await db.query(
                    'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                    [discordId]
                );
                
                if (playerResult.rows.length === 0) {
                    return await interaction.editReply('❌ No player found with that Discord ID.');
                }
                
                playerId = playerResult.rows[0].player_id;
            } 
            // Check if it's a player ID
            else if (playerIdentifier.includes('-')) {
                playerId = playerIdentifier;
            } 
            // Check if it's a wallet address
            else {
                const addressResult = await db.query(
                    'SELECT player_id FROM structs.player_address WHERE address = $1',
                    [playerIdentifier]
                );
                
                if (addressResult.rows.length === 0) {
                    return await interaction.editReply('❌ No player found with that wallet address.');
                }
                
                playerId = addressResult.rows[0].player_id;
            }

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

            // Get player info for the embed
            const playerInfo = await db.query(
                'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                [playerId]
            );

            const username = playerInfo.rows.length > 0 ? playerInfo.rows[0].discord_username : 'Unknown Player';

            // Create the embed
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`Inventory for ${username} (${playerId})`)
                .setDescription('Player inventory and token balances')
                .setTimestamp()
                .setFooter({ text: 'Structs Discord Bot' });

            // Add inventory items to the embed
            if (inventoryResult.rows.length === 0) {
                embed.addFields({ name: 'No Inventory', value: 'This player has no inventory items.' });
            } else {
                // Calculate total alpha value
                const totalAlpha = inventoryResult.rows.reduce((sum, row) => sum + (parseFloat(row.alpha_value) || 0), 0);
                const totalAlphaDisplay = inventoryResult.rows.reduce((sum, row) => {
                    const value = parseFloat(row.display_alpha_value) || 0;
                    return sum + value;
                }, 0);
                
                embed.addFields({ 
                    name: 'Total Alpha Value', 
                    value: `${totalAlphaDisplay.toLocaleString()} α (${totalAlpha.toLocaleString()} ualpha)`,
                    inline: false 
                });
                
                // Add each token to the embed
                inventoryResult.rows.forEach(row => {
                    if (row.token_amount !== 0) {
                        embed.addFields({ 
                            name: row.denom, 
                            value: `${row.display_token_amount} (${row.token_amount} ${row.denom})`,
                            inline: true 
                        });
                    }
                });
            }

            return await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in inventory command:', error);
            return await interaction.editReply('❌ There was an error fetching the inventory information. Please try again later.');
        }
    }
}; 