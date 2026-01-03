const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const { handleError, createSuccessEmbed, validatePlayerRegistration } = require('../utils/errors');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('explore')
        .setDescription('Explore the game world to discover new resources and opportunities'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get player ID from Discord username
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            const registrationError = validatePlayerRegistration(
                playerResult,
                'You are not registered as a player. Please use `/join` to join a guild first.'
            );
            if (registrationError) {
                return await interaction.editReply({ embeds: [registrationError] });
            }

            const playerId = playerResult.rows[0].player_id;

            // Execute the explore transaction
            await db.query(
                'SELECT signer.tx_explore($1)',
                [playerId]
            );

            const embed = createSuccessEmbed(
                'Exploration Request Submitted',
                'Your exploration request has been submitted for processing. You will be assigned a new planet.',
                [
                    { name: 'Player ID', value: playerId, inline: true }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'explore command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 