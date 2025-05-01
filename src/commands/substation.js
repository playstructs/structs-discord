const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('substation')
        .setDescription('Manage substations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new substation')
                .addStringOption(option =>
                    option
                        .setName('allocation')
                        .setDescription('Select the allocation to use for the substation')
                        .setRequired(true)
                        .setAutocomplete(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('player-connect')
                .setDescription('Connect a player to a substation')
                .addStringOption(option =>
                    option
                        .setName('substation')
                        .setDescription('Select the substation')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option
                        .setName('player')
                        .setDescription('Player to connect (ID or @mention)')
                        .setRequired(true)
                        .setAutocomplete(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('player-disconnect')
                .setDescription('Disconnect a player from a substation')
                .addStringOption(option =>
                    option
                        .setName('player')
                        .setDescription('Player to disconnect (ID or @mention)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const subcommand = interaction.options.getSubcommand();
        const choices = [];

        try {
            if (subcommand === 'create') {
                // Get player ID from discord ID
                const playerResult = await db.query(
                    'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                    [interaction.user.id]
                );

                if (playerResult.rows.length === 0) {
                    return await interaction.respond([]);
                }

                const playerId = playerResult.rows[0].player_id;

                // Autocomplete for allocation selection
                const result = await db.query(
                    `SELECT id || ' ' || structs.UNIT_DISPLAY_FORMAT(
                        (select grid.val from structs.grid where grid.object_index = allocation.index and grid.attribute_type ='power'),
                        'milliwatt'
                    ) || ' (' || allocation_type || ' source:' || source_id || ')' as name,
                    id as value
                    FROM allocation
                    WHERE controller IN (
                        SELECT player_address.address
                        FROM structs.player_address
                        WHERE player_address.player_id = $1
                    )
                    AND destination_id = ''`,
                    [playerId]
                );

                choices.push(...result.rows.map(row => ({
                    name: row.name,
                    value: row.value
                })));
            } else if (subcommand === 'player-connect') {
                const focusedOption = interaction.options.getFocused(true);
                
                if (focusedOption.name === 'substation') {
                    // Get player ID from discord ID
                    const playerResult = await db.query(
                        'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                        [interaction.user.id]
                    );

                    if (playerResult.rows.length === 0) {
                        return await interaction.respond([]);
                    }

                    const playerId = playerResult.rows[0].player_id;

                    // Autocomplete for substation selection
                    const result = await db.query(
                        `SELECT substation_id || ' (' || structs.UNIT_DISPLAY_FORMAT(
                            (connection_capacity_p*connection_count)/(connection_count+1),
                            'milliwatt'
                        ) || ' Per Player)' as name,
                        substation_id as value
                        FROM view.substation
                        WHERE substation_id IN (
                            SELECT permission.object_id
                            FROM permission
                            WHERE permission.object_id = substation.substation_id
                            AND (permission.val & 32) > 0
                            AND permission.player_id = $1
                        )`,
                        [playerId]
                    );

                    choices.push(...result.rows.map(row => ({
                        name: row.name,
                        value: row.value
                    })));
                } else if (focusedOption.name === 'player') {
                    // Get player ID from discord ID
                    const playerResult = await db.query(
                        'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                        [interaction.user.id]
                    );

                    if (playerResult.rows.length === 0) {
                        return await interaction.respond([]);
                    }

                    const playerId = playerResult.rows[0].player_id;

                    // Autocomplete for player selection
                    const result = await db.query(
                        `SELECT 'My Account' as name, $1 as value
                         UNION
                         SELECT '@' || player_discord.discord_username, player_discord.player_id
                         FROM player_discord
                         UNION
                         SELECT player.id, player_id
                         FROM structs.player`,
                        [playerId]
                    );

                    choices.push(...result.rows.map(row => ({
                        name: row.name,
                        value: row.value
                    })));
                }
            } else if (subcommand === 'player-disconnect') {
                // Get player ID from discord ID
                const playerResult = await db.query(
                    'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                    [interaction.user.id]
                );

                if (playerResult.rows.length === 0) {
                    return await interaction.respond([]);
                }

                const playerId = playerResult.rows[0].player_id;

                // Autocomplete for player selection
                const result = await db.query(
                    `SELECT 'My Account' as name, $1 as value
                     UNION
                     SELECT '@' || player_discord.discord_username, player_discord.player_id
                     FROM player_discord
                     UNION
                     SELECT player.id, player_id
                     FROM structs.player`,
                    [playerId]
                );

                choices.push(...result.rows.map(row => ({
                    name: row.name,
                    value: row.value
                })));
            }

            await interaction.respond(choices);
        } catch (error) {
            console.error('Error in substation autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'create': {
                    const allocationId = interaction.options.getString('allocation');

                    // Get player ID from discord ID
                    const playerResult = await db.query(
                        'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                        [interaction.user.id]
                    );

                    if (playerResult.rows.length === 0) {
                        return await interaction.editReply(`${EMOJIS.STATUS.ERROR} Player not found. Please ensure you are registered.`);
                    }

                    const playerId = playerResult.rows[0].player_id;

                    // Create the substation
                    await db.query(
                        'SELECT signer.tx_substation_create($1, $2)',
                        [playerId, allocationId]
                    );

                    const embed = new EmbedBuilder()
                        .setTitle('Substation Created')
                        .setColor('#00ff00')
                        .setDescription('Your substation has been created successfully!')
                        .addFields(
                            { name: 'Allocation ID', value: allocationId, inline: true }
                        );

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'player-connect': {
                    const substationId = interaction.options.getString('substation');
                    const targetPlayerId = interaction.options.getString('player');

                    // Get player ID from discord ID
                    const playerResult = await db.query(
                        'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                        [interaction.user.id]
                    );

                    if (playerResult.rows.length === 0) {
                        return await interaction.editReply(`${EMOJIS.STATUS.ERROR} Player not found. Please ensure you are registered.`);
                    }

                    const playerId = playerResult.rows[0].player_id;

                    // Connect player to substation
                    await db.query(
                        'SELECT signer.tx_substation_player_connect($1, $2, $3)',
                        [playerId, substationId, targetPlayerId]
                    );

                    const embed = new EmbedBuilder()
                        .setTitle('Player Connected')
                        .setColor('#00ff00')
                        .setDescription('Player has been connected to the substation successfully!')
                        .addFields(
                            { name: 'Substation ID', value: substationId, inline: true },
                            { name: 'Player ID', value: targetPlayerId, inline: true }
                        );

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'player-disconnect': {
                    const targetPlayerId = interaction.options.getString('player');

                    // Get player ID from discord ID
                    const playerResult = await db.query(
                        'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                        [interaction.user.id]
                    );

                    if (playerResult.rows.length === 0) {
                        return await interaction.editReply(`${EMOJIS.STATUS.ERROR} Player not found. Please ensure you are registered.`);
                    }

                    const playerId = playerResult.rows[0].player_id;

                    // Disconnect player from substation
                    await db.query(
                        'SELECT signer.tx_substation_player_disconnect($1, $2)',
                        [playerId, targetPlayerId]
                    );

                    const embed = new EmbedBuilder()
                        .setTitle('Player Disconnected')
                        .setColor('#00ff00')
                        .setDescription('Player has been disconnected from the substation successfully!')
                        .addFields(
                            { name: 'Player ID', value: targetPlayerId, inline: true }
                        );

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
            }
        } catch (error) {
            console.error('Error executing substation command:', error);
            await interaction.editReply(`${EMOJIS.STATUS.ERROR} An error occurred while processing your command.`);
        }
    }
}; 