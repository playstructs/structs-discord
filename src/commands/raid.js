const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const crypto = require('crypto');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raid')
        .setDescription('Complete a raid on a planet')
        .addIntegerOption(option =>
            option
                .setName('nonce')
                .setDescription('Nonce value for the raid proof')
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Get player ID and fleet ID
            const playerResult = await db.query(
                'SELECT player_discord.player_id, player.fleet_id FROM structs.player_discord, structs.player WHERE player_discord.player_id=player.id AND player_discord.discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('You are not registered as a player. Please join a guild first.');
            }

            const playerId = playerResult.rows[0].player_id;
            const fleetId = playerResult.rows[0].fleet_id;
            const nonce = interaction.options.getInteger('nonce');

            // Generate SHA-256 hash of the nonce
            const proof = crypto.createHash('sha256')
                .update(nonce.toString())
                .digest('hex');

            // Execute the raid completion transaction
            await db.query(
                'SELECT signer.tx_planet_raid_complete($1, $2, $3, $4)',
                [playerId, fleetId, proof, nonce]
            );

            const embed = new EmbedBuilder()
                .setTitle('Raid Completed')
                .setColor('#00ff00')
                .setDescription('You have successfully completed a raid!')
                .addFields(
                    { name: 'Nonce', value: nonce.toString(), inline: true }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in raid command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    }
}; 