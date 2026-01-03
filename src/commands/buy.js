const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const { handleError, createSuccessEmbed, validatePlayerRegistration } = require('../utils/errors');

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

            // Get player ID - Note: buy.js uses player_external, which may be intentional
            // Keeping this as-is per user instruction to understand differences first
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_external WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                // Try player_discord as fallback
                const fallbackResult = await db.query(
                    'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                    [interaction.user.id]
                );
                
                if (fallbackResult.rows.length === 0) {
                    const { createWarningEmbed } = require('../utils/errors');
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Not Registered',
                            'You need to register first. Use `/join` to get started.'
                        )]
                    });
                }
                
                // Use fallback result
                const playerId = fallbackResult.rows[0].player_id;
                
                // Create the agreement
                await db.query(
                    'SELECT signer.tx_agreement_create($1, $2, $3, $4)',
                    [playerId, providerId, capacity, duration]
                );

                const embed = createSuccessEmbed(
                    'Offer Accepted',
                    'Successfully accepted the resource offer and created an agreement.',
                    [
                        { name: 'Provider ID', value: providerId, inline: true },
                        { name: 'Capacity', value: capacity.toString(), inline: true },
                        { name: 'Duration', value: `${duration} blocks`, inline: true }
                    ]
                );

                return await interaction.editReply({ embeds: [embed] });
            }

            const playerId = playerResult.rows[0].player_id;

            // Create the agreement
            await db.query(
                'SELECT signer.tx_agreement_create($1, $2, $3, $4)',
                [playerId, providerId, capacity, duration]
            );

            const embed = createSuccessEmbed(
                'Offer Accepted',
                'Successfully accepted the resource offer and created an agreement.',
                [
                    { name: 'Provider ID', value: providerId, inline: true },
                    { name: 'Capacity', value: capacity.toString(), inline: true },
                    { name: 'Duration', value: `${duration} blocks`, inline: true }
                ]
            );

            return await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'buy command', interaction);
            return await interaction.editReply({ embeds: [embed] });
        }
    }
}; 