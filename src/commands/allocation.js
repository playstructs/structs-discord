const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createSuccessEmbed, validatePlayerRegistration, createWarningEmbed } = require('../utils/errors');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allocation')
        .setDescription('Manage resource allocations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new allocation')
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
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('connect')
                .setDescription('Connect an allocation to a substation')
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
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disconnect')
                .setDescription('Disconnect an allocation from its destination')
                .addStringOption(option =>
                    option
                        .setName('allocation')
                        .setDescription('Select an allocation to disconnect')
                        .setRequired(true)
                        .setAutocomplete(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfer')
                .setDescription('Transfer an allocation to another player')
                .addStringOption(option =>
                    option
                        .setName('allocation')
                        .setDescription('Select an allocation to transfer')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option
                        .setName('controller')
                        .setDescription('Select the new controller (player address)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const focusedOption = interaction.options.getFocused(true);
        const subcommand = interaction.options.getSubcommand();

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

            if (subcommand === 'create') {
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
            } else if (subcommand === 'connect') {
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
            } else if (subcommand === 'disconnect') {
                if (focusedOption.name === 'allocation') {
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
                        AND destination_id != ''`,
                        [playerId]
                    );

                    await interaction.respond(
                        result.rows.map(row => ({
                            name: row.name,
                            value: row.value
                        }))
                    );
                }
            } else if (subcommand === 'transfer') {
                if (focusedOption.name === 'allocation') {
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

                    await interaction.respond(
                        result.rows.map(row => ({
                            name: row.name,
                            value: row.value
                        }))
                    );
                } else if (focusedOption.name === 'controller') {
                    const result = await db.query(
                        `WITH base AS (
                            SELECT id as name, primary_address as value FROM structs.player 
                            UNION 
                            SELECT '@' || player_discord.discord_username || '(' || player_discord.discord_id || ')' as name, player.primary_address as value 
                            FROM structs.player_discord, structs.player 
                            WHERE player_discord.player_id = player.id 
                            UNION 
                            SELECT player_address.address as name, player_address.address as value 
                            FROM structs.player_address
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
                }
            }
        } catch (error) {
            console.error('Error in allocation autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

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

            if (subcommand === 'create') {
                const source = interaction.options.getString('source');
                const amount = interaction.options.getString('amount');
                const destination = interaction.options.getString('destination');
                const type = interaction.options.getString('type');

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
                } else {
                    const discordResult = await db.query(
                        'SELECT primary_address from player WHERE id = $1',
                        [destination]
                    );
                    
                    if (discordResult.rows.length === 0) {
                        return await interaction.editReply('Recipient not found or not registered.');
                    }
                    
                    destinationAddress = discordResult.rows[0].primary_address;
                }

                // Create the allocation transaction
                const result = await db.query(
                    'SELECT signer.tx_allocation_create($1, $2, $3, $4)',
                    [type, source, amount, destinationAddress]
                );

                if (result.rows[0].tx_allocate) {
                    const embed = createSuccessEmbed(
                        'Allocation Created',
                        'Successfully created a new allocation.',
                        [
                            { name: 'Type', value: type, inline: true },
                            { name: 'Source', value: source, inline: true },
                            { name: 'Amount', value: amount, inline: true },
                            { name: 'Destination', value: destinationAddress, inline: false },
                            { name: 'Transaction ID', value: result.rows[0].tx_allocate, inline: false }
                        ]
                    );
                    return await interaction.editReply({ embeds: [embed] });
                } else {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Allocation Failed',
                            'Failed to allocate resources. Please check your inputs and try again.'
                        )]
                    });
                }
            } else if (subcommand === 'connect') {
                const allocationId = interaction.options.getString('allocation');
                const substationId = interaction.options.getString('substation');

                // Verify allocation exists and is available
                const allocationCheck = await db.query(
                    `SELECT id FROM structs.allocation 
                     WHERE id = $1`,
                    [allocationId]
                );

                if (allocationCheck.rows.length === 0) {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Invalid Allocation',
                            'The selected allocation is invalid or unavailable.'
                        )]
                    });
                }

                // Verify substation access
                const substationCheck = await db.query(
                    `SELECT id FROM structs.substation 
                     WHERE id = $1`,
                    [substationId]
                );

                if (substationCheck.rows.length === 0) {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Substation Not Found',
                            'The selected substation was not found or you do not have permission to connect to it.'
                        )]
                    });
                }

                // Create connection transaction
                await db.query(
                    'SELECT signer.tx_allocation_connect($1, $2, $3)',
                    [playerId, allocationId, substationId]
                );

                const embed = createSuccessEmbed(
                    'Allocation Connected',
                    'Successfully connected the allocation to the substation.',
                    [
                        { name: 'Allocation ID', value: allocationId, inline: true },
                        { name: 'Substation ID', value: substationId, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'disconnect') {
                const allocationId = interaction.options.getString('allocation');

                // Verify allocation exists and is connected
                const allocationCheck = await db.query(
                    `SELECT id FROM structs.allocation 
                     WHERE id = $1 AND destination_id != ''`,
                    [allocationId]
                );

                if (allocationCheck.rows.length === 0) {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Invalid Allocation',
                            'The selected allocation is invalid or not connected to a destination.'
                        )]
                    });
                }

                // Disconnect allocation
                await db.query(
                    'SELECT signer.tx_allocation_disconnect($1, $2)',
                    [playerId, allocationId]
                );

                const embed = createSuccessEmbed(
                    'Allocation Disconnected',
                    'The allocation has been disconnected successfully.',
                    [
                        { name: 'Allocation ID', value: allocationId, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'transfer') {
                const allocationId = interaction.options.getString('allocation');
                const controller = interaction.options.getString('controller');

                // Verify allocation exists and is available
                const allocationCheck = await db.query(
                    `SELECT id FROM structs.allocation 
                     WHERE id = $1 AND destination_id = ''`,
                    [allocationId]
                );

                if (allocationCheck.rows.length === 0) {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Invalid Allocation',
                            'The selected allocation is invalid or unavailable for transfer.'
                        )]
                    });
                }

                // Transfer allocation
                await db.query(
                    'SELECT signer.tx_allocation_transfer($1, $2, $3)',
                    [playerId, allocationId, controller]
                );

                const embed = createSuccessEmbed(
                    'Allocation Transferred',
                    'The allocation has been transferred successfully.',
                    [
                        { name: 'Allocation ID', value: allocationId, inline: true },
                        { name: 'New Controller', value: controller, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            const { embed } = handleError(error, 'allocation command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 