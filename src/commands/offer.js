const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('offer')
        .setDescription('Create a new resource offer')
        .addStringOption(option =>
            option
                .setName('substation')
                .setDescription('Select your substation')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('resource')
                .setDescription('Select the resource to offer')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addNumberOption(option =>
            option
                .setName('rate')
                .setDescription('The rate per block')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('access')
                .setDescription('Who can accept this offer')
                .setRequired(true)
                .addChoices(
                    { name: 'Open Market', value: 'openMarket' },
                    { name: 'Guild Only', value: 'guildLimited' },
                    { name: 'Closed Market', value: 'closedMarket' }
                )
        )
        .addNumberOption(option =>
            option
                .setName('min_capacity')
                .setDescription('Minimum capacity required')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option
                .setName('max_capacity')
                .setDescription('Maximum capacity allowed')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('min_duration')
                .setDescription('Minimum duration in blocks')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('max_duration')
                .setDescription('Maximum duration in blocks')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option
                .setName('provider_penalty')
                .setDescription('Penalty for provider cancellation')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option
                .setName('consumer_penalty')
                .setDescription('Penalty for consumer cancellation')
                .setRequired(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const focusedOption = interaction.options.getFocused(true);
        const choices = [];
        
        try {
            // Get player ID from Discord username
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.respond([]);
            }

            const playerId = playerResult.rows[0].player_id;

            if (focusedOption.name === 'substation') {
                // Handle substation autocomplete
                const result = await db.query(
                    `SELECT id, name 
                     FROM structs.substation 
                     WHERE owner = $1 
                     AND (id::text ILIKE $2 OR name ILIKE $2)
                     LIMIT 25`,
                    [playerId, `%${focusedValue}%`]
                );

                await interaction.respond(
                    result.rows.map(row => ({
                        name: `${row.name || row.id}`,
                        value: row.id
                    }))
                );
            } else if (focusedOption.name === 'resource') {
                // Handle resource autocomplete using the provided SQL query
                const result = await db.query(
                    `SELECT
                         distinct
                         CASE guild_meta.denom->>'0' WHEN '' THEN 'uguild.'||guild_meta.id ELSE guild_meta.denom->>'0' END as value_smallest,
                         CASE guild_meta.denom->>'6' WHEN '' THEN 'guild.'||guild_meta.id ELSE guild_meta.denom->>'6' END  as value_normal,
                         'uguild.'||guild_meta.id as denom,
                         guild_meta.id as guild_id,
                         guild_meta.name as guild_name,
                         guild_meta.tag as guild_tag
                     from structs.guild_meta;`,
                    []
                );
                
                // Process the results according to the specified format
                choices.push(
                    { name: 'alpha', value: 'alpha' },
                    { name: 'ualpha', value: 'ualpha' }
                );
                result.rows.forEach(row => {
                    // For guild tokens, add all four format options
                    choices.push(
                        {
                            name: `${row.value_smallest} (uguild.${row.guild_id}) - ${row.guild_name}`,
                            value: `uguild.${row.guild_id}`
                        },
                        {
                            name: `uguild.${row.guild_id} (${row.value_smallest}) - ${row.guild_name}`,
                            value: `uguild.${row.guild_id}`
                        },
                        {
                            name: `${row.value_normal} (guild.${row.guild_id}) - ${row.guild_name}`,
                            value: `guild.${row.guild_id}`
                        },
                        {
                            name: `guild.${row.guild_id} (${row.value_normal}) - ${row.guild_name}`,
                            value: `guild.${row.guild_id}`
                        }
                    );

                });
                
                // Filter choices based on user input if provided
                const filteredChoices = focusedValue 
                    ? choices.filter(choice => 
                        choice.name.toLowerCase().includes(focusedValue.toLowerCase()) || 
                        choice.value.toLowerCase().includes(focusedValue.toLowerCase())
                    )
                    : choices;
                
                // Limit to 25 choices
                await interaction.respond(filteredChoices.slice(0, 25));
            }
        } catch (error) {
            console.error('Error in offer autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const substation = interaction.options.getString('substation');
            const resource = interaction.options.getString('resource');
            const rate = interaction.options.getNumber('rate');
            const access = interaction.options.getString('access');
            const minCapacity = interaction.options.getNumber('min_capacity');
            const maxCapacity = interaction.options.getNumber('max_capacity');
            const minDuration = interaction.options.getInteger('min_duration');
            const maxDuration = interaction.options.getInteger('max_duration');
            const providerPenalty = interaction.options.getNumber('provider_penalty');
            const consumerPenalty = interaction.options.getNumber('consumer_penalty');

            // Get player ID
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_external WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('You need to register first. Use `/register` to get started.');
            }

            const playerId = playerResult.rows[0].player_id;

            // Create the provider
            await db.query(
                'SELECT signer.tx_provider_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [
                    playerId,
                    substation,
                    resource,
                    rate,
                    access,
                    minCapacity,
                    maxCapacity,
                    minDuration,
                    maxDuration,
                    providerPenalty,
                    consumerPenalty
                ]
            );

            return await interaction.editReply('Successfully created a new resource offer.');
        } catch (error) {
            console.error(error);
            return await interaction.editReply('There was an error processing your request.');
        }
    }
}; 