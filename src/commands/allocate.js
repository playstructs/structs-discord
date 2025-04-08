const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allocate')
        .setDescription('Allocate resources')
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of allocation')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('source')
                .setDescription('Select source object')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to allocate')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('destination')
                .setDescription('Destination (address, player ID, or @discord)')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const focusedOption = interaction.options.getFocused(true);

        try {
            // Get player ID from Discord username
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return;
            }

            const playerId = playerResult.rows[0].player_id;

            if (focusedOption.name === 'source') {
                const result = await db.query(
                    `WITH base AS (
                        SELECT $1 || ' (Your Player!)' as name, $id as value
                        UNION 
                        SELECT id || '(Your Substation)' as name, id as value from substation where owner = $id
                    ) AS sources
                    SELECT * FROM base
                    WHERE name ILIKE $1
                    LIMIT 25`,
                    [`%${focusedValue}%`]
                );

                await interaction.respond(
                    result.rows.map(row => ({
                        name: row.name,
                        value: row.value
                    }))
                );
            } else if (focusedOption.name === 'destination') {
                const result = await db.query(
                    `WITH base AS (
                        SELECT id as name, id as value FROM structs.player 
                        UNION 
                        SELECT '@' || player_discord.discord_username || '(' || player_discord.discord_id || ')' as name, player_discord.player_id as value FROM structs.player_discord 
                        UNION 
                        SELECT player_address.address as name, player_address.player_id as value FROM structs.player_address
                    ) 
                    SELECT * FROM base
                    WHERE name ILIKE $1
                    LIMIT 25`,
                    [`%${focusedValue}%`]
                );

                await interaction.respond(
                    result.rows.map(row => ({
                        name: row.name,
                        value: row.value
                    }))
                );
            } else if (focusedOption.name === 'type') {
                /* enum allocationType {
                    static              = 0;
                    dynamic             = 1;
                    automated           = 2;
                } */
                const allocationTypes = [
                    { name: 'Static', value: 'static' },
                    { name: 'Dynamic', value: 'dynamic' },
                    { name: 'Automated', value: 'automated' }
                ];

                await interaction.respond(
                    allocationTypes.map(type => ({
                        name: type.name,
                        value: type.value
                    }))
                );
            }
        } catch (error) {
            console.error('Error in allocate autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const source = interaction.options.getString('source');
            const amount = interaction.options.getString('amount');
            const destination = interaction.options.getString('destination');
            const type = interaction.options.getString('type');

            // Get player ID from Discord username
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('You are not registered as a player. Please join a guild first.');
            }

            const playerId = playerResult.rows[0].player_id;

            // Determine the destination ID based on the input format
            let destinationAddress;
            
            if (destination.startsWith('<@')) {
                // It's a Discord mention
                const discordUsername = destination.replace(/[<@!>]/g, '');
                const discordResult = await db.query(
                    'SELECT primary_address from player WHERE id in (SELECT player_id FROM structs.player_discord WHERE discord_username = $1)',
                    [discordUsername]
                );
                
                if (discordResult.rows.length === 0) {
                    return await interaction.editReply('Recipient not found or not registered.');
                }
                
                destinationAddress = discordResult.rows[0].primary_address;
            } else if (destination.startsWith('structs')) {
                // It's a wallet address
                const addressResult = await db.query(
                    'SELECT player_id FROM structs.player_address WHERE address = $1',
                    [destination]
                );
                
                if (addressResult.rows.length === 0) {
                    return await interaction.editReply('Recipient not found or not registered.');
                }
                
                destinationAddress = destination;
            } else if (destination.includes('-')) {
                const discordResult = await db.query(
                    'SELECT primary_address from player WHERE id = $1',
                    [destination]
                );
                
                if (discordResult.rows.length === 0) {
                    return await interaction.editReply('Recipient not found or not registered.');
                }
                
                destinationAddress = discordResult.rows[0].primary_address;
            } else {
                return await interaction.editReply('Invalid destination format. Use a player ID, @username, or wallet address.');
            }

            // Create the allocation transaction
            const result = await db.query(
                'SELECT signer.tx_allocate($1, $2, $3, $4)',
                [type, source, amount, destinationAddress]
            );

            if (result.rows[0].tx_allocate) {
                return await interaction.editReply(`Successfully allocated ${amount} from ${source} to ${destination}. Transaction ID: ${result.rows[0].tx_allocate}`);
            } else {
                return await interaction.editReply('Failed to allocate resources. Please try again.');
            }
        } catch (error) {
            console.error('Error allocating resources:', error);
            await interaction.editReply('An error occurred while allocating resources.');
        }
    }
}; 

