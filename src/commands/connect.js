const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('connect')
        .setDescription('Connect to grid')
        .addStringOption(option =>
            option
                .setName('allocation')
                .setDescription('Select an allocation')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('substation')
                .setDescription('Select a substation')
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

            if (focusedOption.name === 'allocation') {
                const result = await db.query(
                    `SELECT allocation.id, allocation.source_id, allocation.allocation_type 
                     FROM structs.allocation 
                     WHERE allocation.destination_id = '' 
                     AND allocation.controller IN (SELECT player_address.address FROM player_address where player_address.player_id = $1)
                     AND allocation.id::text ILIKE $2
                     LIMIT 25`,
                    [playerId, `%${focusedValue}%`]
                );

                await interaction.respond(
                    result.rows.map(row => ({
                        name: `${row.id} (${row.allocation_type})`,
                        value: row.id
                    }))
                );
            } else if (focusedOption.name === 'substation') {
                const result = await db.query(
                    `SELECT substation.id 
                     FROM structs.substation 
                     WHERE substation.id IN (
                         SELECT permission.object_id 
                         FROM structs.permission 
                         WHERE player_id = $1 
                         AND val >= 112
                     )
                     AND substation.id::text ILIKE $2
                     LIMIT 25`,
                    [playerId, `%${focusedValue}%`]
                );

                await interaction.respond(
                    result.rows.map(row => ({
                        name: row.id,
                        value: row.id
                    }))
                );
            }
        } catch (error) {
            console.error('Error in connect autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Get player ID from Discord username
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('You are not registered as a player. Please join a guild first.');
            }

            const playerId = playerResult.rows[0].player_id;

            // Get connection parameters
            const allocationId = interaction.options.getString('allocation');
            const substationId = interaction.options.getString('substation');

            // Verify allocation exists and is available
            const allocationCheck = await db.query(
                `SELECT id FROM structs.allocation 
                 WHERE id = $1  `,
                [allocationId]
            );

            if (allocationCheck.rows.length === 0) {
                return await interaction.editReply('Invalid or unavailable allocation selected.');
            }

            // Verify substation access
            const substationCheck = await db.query(
                `SELECT id FROM structs.substation 
                 WHERE id = $1 
                 `,
                [substationId]
            );

            if (substationCheck.rows.length === 0) {
                return await interaction.editReply('You do not have permission to connect to this substation.');
            }

            // Create connection transaction
            await db.query(
                'SELECT signer.tx_substation_allocation_connect($1, $2, $3)',
                [playerId, allocationId, substationId]
            );

            await interaction.editReply(
                `Successfully connected allocation ${allocationId} to substation ${substationId}.`
            );
        } catch (error) {
            console.error('Error connecting allocation:', error);
            await interaction.editReply('An error occurred while connecting the allocation.');
        }
    }
}; 