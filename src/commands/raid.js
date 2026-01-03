const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const crypto = require('crypto');
const { handleError, createSuccessEmbed, validatePlayerRegistration, createWarningEmbed } = require('../utils/errors');

/**
 * Raid command module
 * @module commands/raid
 * @description Allows players to complete planet raids using proof-of-work
 */
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

    /**
     * Execute handler for raid command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getInteger - Get integer option value ('nonce')
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get player ID and fleet ID
            const playerResult = await db.query(
                "SELECT player_discord.player_id, player.fleet_id, fleet.location_id as planet_id, (select planet_attribute.val from planet_attribute where attribute_type = 'blockStartRaid' and object_id = fleet.location_id) as active_raid_block FROM structs.player_discord, structs.player, structs.fleet WHERE player_discord.player_id=player.id AND player.fleet_id=fleet.id AND player_discord.discord_id = $1",
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
            const activeRaidBlock = playerResult.rows[0].active_raid_block;
            const nonce = interaction.options.getInteger('nonce');

            if (!fleetId) {
                return await interaction.editReply({ 
                    embeds: [createWarningEmbed(
                        'No Fleet',
                        'You do not have a fleet. You need a fleet to perform raids.'
                    )]
                });
            }

            if (activeRaidBlock === 0 || !activeRaidBlock) {
                return await interaction.editReply({ 
                    embeds: [createWarningEmbed(
                        'No Active Raid',
                        'The fleet is not currently raiding a planet. Deploy your fleet to a planet first to start a raid.'
                    )]
                });
            }

            // performingFleet.Id + "@" + planet.Id + "RAID" + activeRaidBlockString + "NONCE" + strconv.Itoa(i)
            const proofBase = fleetId + "@" + planetId + "RAID" + activeRaidBlock.toString() + "NONCE" + nonce;
            // Generate SHA-256 hash of the nonce
            const proof = crypto.createHash('sha256')
                .update(proofBase)
                .digest('hex');

            // Execute the raid completion transaction
            await db.query(
                'SELECT signer.tx_planet_raid_complete($1, $2, $3, $4)',
                [playerId, fleetId, proof, nonce]
            );

            const embed = createSuccessEmbed(
                'Raid Request Submitted',
                'Your raid request has been submitted for processing.',
                [
                    { name: 'Fleet ID', value: fleetId, inline: true },
                    { name: 'Planet ID', value: planetId, inline: true },
                    { name: 'Active Raid Block', value: activeRaidBlock.toString(), inline: true },
                    { name: 'Nonce', value: nonce.toString(), inline: true },
                    { name: 'Proof', value: proof.substring(0, 16) + '...', inline: false }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'raid command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 