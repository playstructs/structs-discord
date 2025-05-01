const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Accept a resource offer')
        .addStringOption(option =>
            option
                .setName('offer')
                .setDescription('Select the offer to accept')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addNumberOption(option =>
            option
                .setName('capacity')
                .setDescription('The capacity to request')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('duration')
                .setDescription('The duration in blocks')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const providerId = interaction.options.getString('offer');
            const capacity = interaction.options.getNumber('capacity');
            const duration = interaction.options.getInteger('duration');

            // Get player ID
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_external WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('You need to register first. Use `/register` to get started.');
            }

            const playerId = playerResult.rows[0].player_id;

            // Create the agreement
            await db.query(
                'SELECT signer.tx_agreement_create($1, $2, $3, $4)',
                [playerId, providerId, capacity, duration]
            );

            return await interaction.editReply('Successfully accepted the resource offer.');
        } catch (error) {
            console.error(error);
            return await interaction.editReply('There was an error processing your request.');
        }
    }
}; 