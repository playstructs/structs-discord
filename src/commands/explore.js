const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');

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

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('You are not registered as a player. Please join a guild first.');
            }

            const playerId = playerResult.rows[0].player_id;

            const embed = new EmbedBuilder()
                .setTitle('Exploration Request Submitted')
                .setColor('#00ff00')
                .setDescription('Your exploration request has been submitted for processing.')
                .addFields(
                    { name: 'Player ID', value: playerId, inline: true }
                );

            await interaction.editReply({ embeds: [embed] });

            // Execute the explore transaction
            await db.query(
                'SELECT signer.tx_explore($1)',
                [playerId]
            );
        } catch (error) {
            console.error('Error executing explore command:', error);
            await interaction.editReply(`${EMOJIS.STATUS.ERROR} An error occurred while processing your exploration request.`);
        }
    }
}; 