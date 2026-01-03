const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createSuccessEmbed, createWarningEmbed, validatePlayerRegistration } = require('../utils/errors');
const { getFleetStatus } = require('../utils/status');

/**
 * Fleet management command module
 * @module commands/fleet
 * @description Manages fleet deployment and return operations
 */
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
                .setDescription('Return your fleet to your planet'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your fleet status')),

    /**
     * Autocomplete handler for fleet command
     * @param {Object} interaction - Discord autocomplete interaction
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getFocused - Get focused option value
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand
     * @param {Function} interaction.respond - Respond with autocomplete choices
     */
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

    /**
     * Execute handler for fleet command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand ('deploy' or 'return')
     * @param {Function} interaction.options.getString - Get string option value
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'deploy') {
                // Get player ID and fleet ID
                const playerResult = await db.query(
                    'SELECT player_discord.player_id, player.fleet_id FROM structs.player_discord, structs.player WHERE player_discord.player_id=player.id AND player_discord.discord_id = $1',
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
                const fleetId = playerResult.rows[0].fleet_id;
                const destinationId = interaction.options.getString('destination');

                if (!fleetId) {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'No Fleet',
                            'You do not have a fleet. You need a fleet to deploy.'
                        )]
                    });
                }

                // Execute the fleet move transaction
                await db.query(
                    'SELECT signer.tx_fleet_move($1, $2, $3)',
                    [playerId, fleetId, destinationId]
                );

                const embed = createSuccessEmbed(
                    'Fleet Deployment Submitted',
                    'Your fleet deployment request has been submitted for processing.',
                    [
                        { name: 'Fleet ID', value: fleetId, inline: true },
                        { name: 'Destination', value: destinationId, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'return') {
                // Get player ID, fleet ID, and planet ID
                const playerResult = await db.query(
                    'SELECT player_discord.player_id, player.fleet_id, player.planet_id FROM structs.player_discord, structs.player WHERE player_discord.player_id=player.id AND player_discord.discord_id = $1',
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
                const fleetId = playerResult.rows[0].fleet_id;
                const planetId = playerResult.rows[0].planet_id;

                if (!fleetId) {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'No Fleet',
                            'You do not have a fleet to return.'
                        )]
                    });
                }

                if (!planetId) {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'No Planet',
                            'You do not have a planet to return to. Use `/explore` to discover a planet first.'
                        )]
                    });
                }

                // Execute the fleet move transaction
                await db.query(
                    'SELECT signer.tx_fleet_move($1, $2, $3)',
                    [playerId, fleetId, planetId]
                );

                const embed = createSuccessEmbed(
                    'Fleet Return Submitted',
                    'Your fleet return request has been submitted for processing.',
                    [
                        { name: 'Fleet ID', value: fleetId, inline: true },
                        { name: 'Destination', value: planetId, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'status') {
                const fleetStatus = await getFleetStatus(playerId);

                if (!fleetStatus) {
                    return await interaction.editReply({
                        embeds: [createWarningEmbed(
                            'No Fleet',
                            'You do not have a fleet. You need a fleet to check status.'
                        )]
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.STRUCT.FLEET} Fleet Status: ${fleetStatus.fleet_id}`)
                    .setColor(0x0099ff)
                    .addFields(
                        { name: '📍 Location', value: fleetStatus.planet_id || 'N/A', inline: true },
                        { name: '👤 Owner', value: fleetStatus.owner, inline: true }
                    )
                    .setTimestamp();

                if (fleetStatus.commandShip) {
                    embed.addFields({
                        name: '🚢 Command Ship',
                        value: `${fleetStatus.commandShip.id} ${fleetStatus.commandShip.type}`,
                        inline: false
                    });
                }

                if (fleetStatus.raidStatus.isRaiding) {
                    embed.addFields({
                        name: '⚔️ Active Raid',
                        value: `Target: ${fleetStatus.raidStatus.targetPlanet}\n` +
                               `Started: Block ${fleetStatus.raidStatus.startBlock}\n` +
                               `Current: Block ${fleetStatus.raidStatus.currentBlock || 'N/A'}\n` +
                               `Elapsed: ${fleetStatus.raidStatus.blocksElapsed || 'N/A'} blocks`,
                        inline: false
                    });
                } else {
                    embed.addFields({
                        name: '⚔️ Raid Status',
                        value: 'Not raiding',
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            const { embed } = handleError(error, 'fleet command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 