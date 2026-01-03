const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createSuccessEmbed } = require('../utils/errors');
const { getPlayerIdWithValidation } = require('../utils/player');

/**
 * Player-resume command module
 * @module commands/player-resume
 * @description Allows players to resume their account activity
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('player-resume')
        .setDescription('Resume your player account'),

    /**
     * Execute handler for player-resume command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get player ID with validation
            const playerResult = await getPlayerIdWithValidation(
                interaction.user.id,
                'You are not registered as a player. Please use `/join` to join a guild first.'
            );
            
            if (playerResult.error) {
                return await interaction.editReply({ embeds: [playerResult.error] });
            }

            const playerId = playerResult.playerId;

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