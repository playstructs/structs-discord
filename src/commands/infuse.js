const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');

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
        await interaction.deferReply();

        try {
            const destination = interaction.options.getString('destination');
            const amount = interaction.options.getNumber('amount');
            const denom = interaction.options.getString('denom');

            // Get player ID from discord ID
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('Player not found. Please ensure you are registered.');
            }

            const playerId = playerResult.rows[0].player_id;

            // Execute the infuse transaction
            await db.query(
                'SELECT signer.tx_infuse($1, $2, $3, $4)',
                [playerId, destination, amount, denom]
            );

            const embed = new EmbedBuilder()
                .setTitle('Power Infusion')
                .setColor('#00ff00')
                .addFields(
                    { name: 'Destination', value: destination, inline: true },
                    { name: 'Amount', value: amount.toString(), inline: true },
                    { name: 'Denomination', value: denom, inline: true }
                )
                .setDescription('Power infusion completed successfully!');

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error executing infuse command:', error);
            await interaction.editReply('An error occurred while processing your request.');
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