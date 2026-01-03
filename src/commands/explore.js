const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const { handleError, createSuccessEmbed } = require('../utils/errors');
const { getPlayerIdWithValidation } = require('../utils/player');

/**
 * Explore command module
 * @module commands/explore
 * @description Allows players to explore the game world and discover new planets
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('explore')
        .setDescription('Explore the game world to discover new resources and opportunities'),

    /**
     * Execute handler for explore command
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