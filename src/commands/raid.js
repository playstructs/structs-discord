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
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get player ID and fleet ID
            const playerResult = await db.query(
                "SELECT player_discord.player_id, player.fleet_id, fleet.location_id as planet_id, (select planet_attribute.val from planet_attribute where attribute_type = 'blockStartRaid' and object_id = fleet.location_id) as active_raid_block FROM structs.player_discord, structs.player, structs.fleet WHERE player_discord.player_id=player.id AND player.fleet_id=fleet.id AND player_discord.discord_id = $1",
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('You are not registered as a player. Please join a guild first.');
            }

            const playerId = playerResult.rows[0].player_id;
            const fleetId = playerResult.rows[0].fleet_id;
            const planetId = playerResult.rows[0].planet_id;
            const activeRaidBlock = playerResult.rows[0].active_raid_block;
            const nonce = interaction.options.getInteger('nonce');

            if (activeRaidBlock === 0) {
                return await interaction.editReply('The fleet is not currently raiding a planet!');
            }

            // performingFleet.Id + "@" + planet.Id + "RAID" + activeRaidBlockString + "NONCE" + strconv.Itoa(i)
            const proofBase = fleetId + "@" + planetId + "RAID" + activeRaidBlock.toString() + "NONCE" + nonce.toString();
            // Generate SHA-256 hash of the nonce
            const proof = crypto.createHash('sha256')
                .update(proofBase)
                .digest('hex');

            const embed = new EmbedBuilder()
                .setTitle('Raid Request Submitted')
                .setColor('#00ff00')
                .setDescription('Your raid request has been submitted for processing.')
                .addFields(
                    { name: 'Nonce', value: nonce.toString(), inline: true },
                    { name: 'Proof', value: proof, inline: true },
                    { name: 'Proof Base', value: proofBase, inline: false },
                    { name: 'Fleet ID', value: fleetId, inline: true },
                    { name: 'Planet ID', value: planetId, inline: true },
                    { name: 'Active Raid Block', value: activeRaidBlock, inline: true }
                );

            await interaction.editReply({ embeds: [embed] });

   
            // Execute the raid completion transaction
            await db.query(
                'SELECT signer.tx_planet_raid_complete($1, $2, $3, $4)',
                [playerId, fleetId, proof, nonce]
            );
        } catch (error) {
            console.error('Error executing raid command:', error);
            await interaction.editReply(`${EMOJIS.STATUS.ERROR} An error occurred while processing your raid request.`);
        }
    }
}; 