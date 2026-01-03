const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const { handleError, createSuccessEmbed, validatePlayerRegistration } = require('../utils/errors');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infuse')
        .setDescription('Infuse power into a destination')
        .addStringOption(option =>
            option
                .setName('destination')
                .setDescription('Destination to infuse power into')
                .setRequired(true)
                .setAutocomplete(true))
        .addNumberOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to infuse')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('denom')
                .setDescription('Denomination to use')
                .setRequired(true)
                .addChoices(
                    { name: 'ualpha', value: 'ualpha' },
                    { name: 'alpha', value: 'alpha' }
                )),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const destination = interaction.options.getString('destination');
            const amount = interaction.options.getNumber('amount');
            const denom = interaction.options.getString('denom');

            // Get player ID from discord ID
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            const registrationError = validatePlayerRegistration(
                playerResult,
                'Player not found. Please ensure you are registered using `/join`.'
            );
            if (registrationError) {
                return await interaction.editReply({ embeds: [registrationError] });
            }

            const playerId = playerResult.rows[0].player_id;

            // Execute the infuse transaction
            await db.query(
                'SELECT signer.tx_infuse($1, $2, $3, $4)',
                [playerId, destination, amount, denom]
            );

            const embed = createSuccessEmbed(
                'Power Infusion',
                'Power infusion completed successfully!',
                [
                    { name: 'Destination', value: destination, inline: true },
                    { name: 'Amount', value: amount.toString(), inline: true },
                    { name: 'Denomination', value: denom, inline: true }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'infuse command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            const result = await db.query(
                `WITH base AS (
                    SELECT reactor.id as name, reactor.validator as value 
                    FROM structs.reactor
                    UNION
                    SELECT reactor.validator as name, reactor.validator as value 
                    FROM structs.reactor
                    UNION
                    SELECT guild_meta.id || ' ' || guild_meta.name ||' (' || guild_meta.tag ||')' as name, 
                           reactor.validator as value 
                    FROM structs.guild_meta 
                    LEFT JOIN structs.guild ON guild.id = guild_meta.id 
                    LEFT JOIN structs.reactor ON reactor.id = guild.primary_reactor_id
                    UNION
                    SELECT struct.id || ' ' || struct_type.type || ' (' || struct.owner || ')' as name, 
                           struct.id as value 
                    FROM structs.struct 
                    LEFT JOIN structs.struct_type ON struct_type.id = struct.type 
                    AND struct_type.power_generation <> 'noPowerGeneration'
                )
                SELECT * FROM base WHERE name ILIKE $1
                LIMIT 25`,
                [`%${focusedValue}%`]
            );

            await interaction.respond(
                result.rows.map(row => ({
                    name: row.name,
                    value: row.value
                }))
            );
        } catch (error) {
            console.error('Error in infuse autocomplete:', error);
        }
    }
}; 