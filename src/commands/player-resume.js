const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createSuccessEmbed, validatePlayerRegistration } = require('../utils/errors');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('player-resume')
        .setDescription('Resume your player account'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get player ID
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

            // Execute the player resume transaction
            await db.query(
                'SELECT signer.tx_player_resume($1)',
                [playerId]
            );

            const embed = createSuccessEmbed(
                'Resume Request Submitted',
                'Your account resume request has been submitted for processing.',
                [
                    { name: 'Player ID', value: playerId, inline: true }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'player-resume command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 