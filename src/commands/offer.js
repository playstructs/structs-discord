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

    async execute(interaction) {
        await interaction.deferReply();

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