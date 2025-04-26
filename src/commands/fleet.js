const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fleet')
        .setDescription('Manage your fleet')
        .addSubcommand(subcommand =>
            subcommand
                .setName('deploy')
                .setDescription('Deploy your fleet to a destination')
                .addStringOption(option =>
                    option
                        .setName('destination')
                        .setDescription('Select the destination to deploy to')
                        .setRequired(true)
                        .setAutocomplete(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('return')
                .setDescription('Return your fleet to your planet')),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'deploy') {
                const result = await db.query(
                    `SELECT '@' || player_discord.discord_username as name, 
                            player.planet_id as value 
                     FROM structs.player_discord, structs.player 
                     WHERE player_discord.player_id = player.id 
                     AND player.planet_id <> ''
                     AND ('@' || player_discord.discord_username) ILIKE $1
                     UNION
                     SELECT planet.id || ' ' || planet.owner as name, 
                            planet.id as value 
                     FROM structs.planet 
                     WHERE planet.status = 'active'
                     AND (planet.id || ' ' || planet.owner) ILIKE $1
                     LIMIT 25`,
                    [`%${focusedValue}%`]
                );

                const choices = result.rows.map(row => ({
                    name: row.name,
                    value: row.value
                }));

                await interaction.respond(choices);
            }
        } catch (error) {
            console.error('Error in fleet autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'deploy') {
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
                const destinationId = interaction.options.getString('destination');

                // Execute the fleet move transaction
                await db.query(
                    'SELECT signer.tx_fleet_move($1, $2, $3)',
                    [playerId, fleetId, destinationId]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Fleet Deployed')
                    .setColor('#00ff00')
                    .setDescription('You have successfully deployed your fleet!')
                    .addFields(
                        { name: 'Destination', value: destinationId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'return') {
                // Get player ID, fleet ID, and planet ID
                const playerResult = await db.query(
                    'SELECT player_discord.player_id, player.fleet_id, player.planet_id FROM structs.player_discord, structs.player WHERE player_discord.player_id=player.id AND player_discord.discord_id = $1',
                    [interaction.user.id]
                );

                if (playerResult.rows.length === 0) {
                    return await interaction.editReply('You are not registered as a player. Please join a guild first.');
                }

                const playerId = playerResult.rows[0].player_id;
                const fleetId = playerResult.rows[0].fleet_id;
                const planetId = playerResult.rows[0].planet_id;

                if (!planetId) {
                    return await interaction.editReply('You do not have a planet to return to.');
                }

                // Execute the fleet move transaction
                await db.query(
                    'SELECT signer.tx_fleet_move($1, $2, $3)',
                    [playerId, fleetId, planetId]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Fleet Returning')
                    .setColor('#00ff00')
                    .setDescription('Your fleet is returning to your planet!')
                    .addFields(
                        { name: 'Destination', value: planetId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error in fleet command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    }
}; 