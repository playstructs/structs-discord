const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grid')
        .setDescription('Grid-related commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('wire')
                .setDescription('Transfer resources between players')
                .addStringOption(option =>
                    option
                        .setName('denom')
                        .setDescription('The denomination to transfer')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option
                        .setName('amount')
                        .setDescription('The amount to transfer')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('recipient')
                        .setDescription('The recipient (player ID or @discord)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('provide')
                .setDescription('Create a new provider')
                .addStringOption(option =>
                    option
                        .setName('substation')
                        .setDescription('Select a substation')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option
                        .setName('rate_denom')
                        .setDescription('Select rate denomination')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addNumberOption(option =>
                    option
                        .setName('rate_amount')
                        .setDescription('Rate amount')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('access_policy')
                        .setDescription('Select access policy')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Open Market', value: 'open-market' },
                            { name: 'Guild Limited', value: 'guild-market' },
                            { name: 'Closed Market', value: 'closed-market' }
                        )
                )
                .addNumberOption(option =>
                    option
                        .setName('provider_penalty')
                        .setDescription('Provider cancellation penalty (%)')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option
                        .setName('consumer_penalty')
                        .setDescription('Consumer cancellation penalty (%)')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option
                        .setName('capacity_min')
                        .setDescription('Minimum capacity')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option
                        .setName('capacity_max')
                        .setDescription('Maximum capacity')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option
                        .setName('duration_min')
                        .setDescription('Minimum duration')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option
                        .setName('duration_max')
                        .setDescription('Maximum duration')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('agree')
                .setDescription('Agree to a provider')
                .addStringOption(option =>
                    option.setName('provider_id')
                        .setDescription('Provider ID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('capacity')
                        .setDescription('Capacity')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Duration')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
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
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('allocate')
                .setDescription('Allocate resources')
                .addStringOption(option =>
                    option.setName('source')
                        .setDescription('Select source object')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to allocate')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('destination')
                        .setDescription('Destination (address, player ID, or @discord)')
                        .setRequired(true))),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'wire') {
                const denom = interaction.options.getString('denom');
                const amount = interaction.options.getString('amount');
                const recipient = interaction.options.getString('recipient');

                // Check if recipient is a Discord mention or player ID
                let recipientId;
                if (recipient.startsWith('<@')) {
                    // Extract Discord username from mention
                    const discordUsername = recipient.replace(/[<@!>]/g, '');
                    
                    // Get player ID from Discord username
                    const playerResult = await db.query(
                        'SELECT id FROM structs.player_meta WHERE username = $1',
                        [discordUsername]
                    );

                    if (playerResult.rows.length === 0) {
                        return await interaction.editReply('Recipient not found. Please provide a valid Discord username or player ID.');
                    }

                    recipientId = playerResult.rows[0].id;
                } else {
                    recipientId = recipient;
                }

                // Get sender's player ID
                const senderResult = await db.query(
                    'SELECT id FROM structs.player_meta WHERE username = $1',
                    [interaction.user.username]
                );

                if (senderResult.rows.length === 0) {
                    return await interaction.editReply('You are not registered as a player. Please register first.');
                }

                const senderId = senderResult.rows[0].id;

                // Create transfer transaction
                await db.query(
                    'SELECT signer.tx_bank_send($1, $2, $3, $4)',
                    [senderId, amount, denom, recipientId]
                );

                await interaction.editReply(`Successfully initiated transfer of ${amount} ${denom} to ${recipient}`);
            } else if (subcommand === 'provide') {
                // Get player ID from Discord username
                const playerResult = await db.query(
                    'SELECT id FROM structs.player_meta WHERE username = $1',
                    [interaction.user.username]
                );

                if (playerResult.rows.length === 0) {
                    return await interaction.editReply('You are not registered as a player. Please register first.');
                }

                const playerId = playerResult.rows[0].id;

                // Get all the provider options
                const substationId = interaction.options.getString('substation');
                const rateDenom = interaction.options.getString('rate_denom');
                const rateAmount = interaction.options.getNumber('rate_amount');
                const accessPolicy = interaction.options.getString('access_policy');
                const providerPenalty = interaction.options.getNumber('provider_penalty');
                const consumerPenalty = interaction.options.getNumber('consumer_penalty');
                const capacityMin = interaction.options.getNumber('capacity_min');
                const capacityMax = interaction.options.getNumber('capacity_max');
                const durationMin = interaction.options.getNumber('duration_min');
                const durationMax = interaction.options.getNumber('duration_max');

                // Create provider transaction
                await db.query(
                    'SELECT signer.tx_provider_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                    [
                        playerId,
                        substationId,
                        rateDenom,
                        rateAmount,
                        accessPolicy,
                        providerPenalty,
                        consumerPenalty,
                        capacityMin,
                        capacityMax,
                        durationMin,
                        durationMax
                    ]
                );

                await interaction.editReply(
                    `Successfully created provider with rate ${rateAmount} ${rateDenom} and ${accessPolicy} access policy.`
                );
            } else {
                switch (subcommand) {
                    case 'agree':
                        await handleAgree(interaction);
                        break;
                    case 'connect':
                        await handleConnect(interaction);
                        break;
                    case 'allocate':
                        await handleAllocate(interaction);
                        break;
                }
            }
        } catch (error) {
            console.error('Error executing grid command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'wire' && focusedValue.name === 'denom') {
                const result = await db.query(
                    `SELECT  denom, identifier 
                     FROM (
                         SELECT 'ualpha' as identifier, 'ualpha' as denom
                         UNION ALL
                         SELECT 'uguild.'|| guild_meta.id as identifier, 
                                guild_meta.denom->>'0' as denom 
                         FROM structs.guild_meta where guild_meta.denom->>'0' != ''
                         UNION ALL
                         SELECT 'uguild.'|| guild.id as identifier, 
                                'uguild.'|| guild.id as denom 
                         FROM structs.guild
                     ) as denoms
                     WHERE denom ILIKE $1
                     LIMIT 25`,
                    [`%${focusedValue}%`]
                );

                await interaction.respond(
                    result.rows.map(row => ({
                        name: row.identifier,
                        value: row.denom
                    }))
                );
            } else if (subcommand === 'provide') {
                if (focusedValue.name === 'substation') {
                    // Get player ID from Discord username
                    const playerResult = await db.query(
                        'SELECT id FROM structs.player_meta WHERE username = $1',
                        [interaction.user.username]
                    );

                    if (playerResult.rows.length === 0) {
                        return;
                    }

                    const playerId = playerResult.rows[0].id;

                    const result = await db.query(
                        `SELECT substation.id 
                         FROM structs.substation 
                         WHERE substation.id IN (
                             SELECT permission.object_id 
                             FROM structs.permission 
                             WHERE player_id = $1 
                             AND val = 'connect_and_allocate'
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
                } else if (focusedValue.name === 'rate_denom') {
                    const result = await db.query(
                        `SELECT denom, identifier 
                         FROM (
                             SELECT 'ualpha' as identifier, 'ualpha' as denom
                             UNION ALL
                             SELECT 'uguild.'|| guild_meta.id as identifier, 
                                    guild_meta.denom->>'0' as denom 
                             FROM structs.guild_meta where guild_meta.denom->>'0' != ''
                             UNION ALL
                             SELECT 'uguild.'|| guild.id as identifier, 
                                    'uguild.'|| guild.id as denom 
                             FROM structs.guild
                         ) as denoms
                         WHERE denom ILIKE $1
                         LIMIT 25`,
                        [`%${focusedValue}%`]
                    );

                    await interaction.respond(
                        result.rows.map(row => ({
                            name: row.identifier,
                            value: row.denom
                        }))
                    );
                }
            } else if (subcommand === 'connect') {
                // Get player ID from Discord username
                const playerResult = await db.query(
                    'SELECT id FROM structs.player_meta WHERE username = $1',
                    [interaction.user.username]
                );

                if (playerResult.rows.length === 0) {
                    return;
                }

                const playerId = playerResult.rows[0].id;

                if (focusedValue.name === 'allocation') {
                    const result = await db.query(
                        `SELECT allocation.id, allocation.source_id, allocation.allocation_type 
                         FROM structs.allocation 
                         WHERE allocation.destination_id = '' 
                         AND allocation.controller = $1
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
                } else if (focusedValue.name === 'substation') {
                    const result = await db.query(
                        `SELECT substation.id 
                         FROM structs.substation 
                         WHERE substation.id IN (
                             SELECT permission.object_id 
                             FROM structs.permission 
                             WHERE player_id = $1 
                             AND val = 'connect_and_allocate'
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
            }
        } catch (error) {
            console.error('Error in autocomplete:', error);
        }
    }
};

async function handleAgree(interaction) {
    try {
        // Get player ID from Discord username
        const playerResult = await db.query(
            'SELECT id FROM structs.player_meta WHERE username = $1',
            [interaction.user.username]
        );

        if (playerResult.rows.length === 0) {
            return await interaction.editReply('You are not registered as a player. Please register first.');
        }

        const playerId = playerResult.rows[0].id;

        // Get agreement parameters
        const providerId = interaction.options.getString('provider_id');
        const capacity = interaction.options.getString('capacity');
        const duration = interaction.options.getString('duration');

        // Create agreement transaction
        await db.query(
            'SELECT signer.tx_agreement_create($1, $2, $3, $4)',
            [playerId, providerId, duration, capacity]
        );

        await interaction.editReply(
            `Successfully created agreement with provider ${providerId} for ${capacity} capacity and ${duration} duration.`
        );
    } catch (error) {
        console.error('Error creating agreement:', error);
        await interaction.editReply('An error occurred while creating the agreement.');
    }
}

async function handleConnect(interaction) {
    try {
        // Get player ID from Discord username
        const playerResult = await db.query(
            'SELECT id FROM structs.player_meta WHERE username = $1',
            [interaction.user.username]
        );

        if (playerResult.rows.length === 0) {
            return await interaction.editReply('You are not registered as a player. Please register first.');
        }

        const playerId = playerResult.rows[0].id;

        // Get connection parameters
        const allocationId = interaction.options.getString('allocation');
        const substationId = interaction.options.getString('substation');

        // Verify allocation exists and is available
        const allocationCheck = await db.query(
            `SELECT id FROM structs.allocation 
             WHERE id = $1 
             AND destination_id = '' 
             AND controller = $2`,
            [allocationId, playerId]
        );

        if (allocationCheck.rows.length === 0) {
            return await interaction.editReply('Invalid or unavailable allocation selected.');
        }

        // Verify substation access
        const substationCheck = await db.query(
            `SELECT id FROM structs.substation 
             WHERE id = $1 
             AND id IN (
                 SELECT permission.object_id 
                 FROM structs.permission 
                 WHERE player_id = $2 
                 AND val = 'connect_and_allocate'
             )`,
            [substationId, playerId]
        );

        if (substationCheck.rows.length === 0) {
            return await interaction.editReply('You do not have permission to connect to this substation.');
        }

        // Create connection transaction
        await db.query(
            'SELECT signer.tx_allocation_connect($1, $2, $3)',
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

async function handleAllocate(interaction) {
    const source = interaction.options.getString('source');
    const amount = interaction.options.getString('amount');
    const destination = interaction.options.getString('destination');
    // TODO: Implement allocate logic
    await interaction.reply(`Allocating ${amount} from ${source} to ${destination}`);
} 