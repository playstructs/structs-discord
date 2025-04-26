const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('player-resume')
        .setDescription('Resume your player account'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Get player ID
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('You are not registered as a player. Please join a guild first.');
            }

            const playerId = playerResult.rows[0].player_id;

            // Execute the player resume transaction
            await db.query(
                'SELECT signer.tx_player_resume($1)',
                [playerId]
            );

            const embed = new EmbedBuilder()
                .setTitle('Account Resumed')
                .setColor('#00ff00')
                .setDescription('You have successfully resumed your player account!');

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in player-resume command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    }
}; 