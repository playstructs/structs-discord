const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('explore')
        .setDescription('Explore the game world to discover new resources and opportunities'),

    async execute(interaction) {
        await interaction.deferReply();

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

            // Execute the explore transaction
            await db.query(
                'SELECT signer.tx_explore($1)',
                [playerId]
            );

            const embed = new EmbedBuilder()
                .setTitle('Exploration Complete')
                .setColor('#00ff00')
                .setDescription('You have successfully explored the area!')
                .addFields(
                    { name: 'Player ID', value: playerId, inline: true }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in explore command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    }
}; 