const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { handleError, createSuccessEmbed } = require('../utils/errors');
const { getPlayerId, getPlayerIdWithValidation } = require('../utils/player');

/**
 * Redeem command module
 * @module commands/redeem
 * @description Allows players to redeem guild tokens from the guild bank
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Redeem tokens from guild bank')
        .addStringOption(option =>
            option
                .setName('denom')
                .setDescription('Denomination to redeem')
                .setRequired(true)
                .setAutocomplete(true))
        .addNumberOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to redeem')
                .setRequired(true)),

    /**
     * Execute handler for redeem command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getString - Get string option value ('denom')
     * @param {Function} interaction.options.getNumber - Get number option value ('amount')
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const denom = interaction.options.getString('denom');
            const amount = interaction.options.getNumber('amount');

            // Get player ID with validation
            const playerResult = await getPlayerIdWithValidation(
                interaction.user.id,
                'Player not found. Please ensure you are registered using `/join`.'
            );
            
            if (playerResult.error) {
                return await interaction.editReply({ embeds: [playerResult.error] });
            }

            const playerId = playerResult.playerId;

            // Execute the redeem transaction
            await db.query(
                'SELECT signer.tx_guild_bank_redeem($1, $2, $3)',
                [playerId, amount, denom]
            );

            const embed = createSuccessEmbed(
                'Guild Bank Redemption',
                'Redemption completed successfully!',
                [
                    { name: 'Denomination', value: denom, inline: true },
                    { name: 'Amount', value: amount.toString(), inline: true }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'redeem command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Autocomplete handler for redeem command
     * @param {Object} interaction - Discord autocomplete interaction
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getFocused - Get focused option value
     * @param {Function} interaction.respond - Respond with autocomplete choices
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            // Get player ID (no validation needed for autocomplete)
            const playerId = await getPlayerId(interaction.user.id);
            
            if (!playerId) {
                return await interaction.respond([]);
            }

            const choices = [];

            const result = await db.query(
                `WITH base AS (
                    SELECT
                        SUM(CASE
                            WHEN ledger.direction = 'debit' THEN ledger.amount_p * -1
                            ELSE ledger.amount_p 
                        END) as hard_balance,
                        denom as denom
                    FROM structs.ledger, structs.player_address
                    WHERE
                        player_address.address = ledger.address
                        AND player_address.player_id = $1
                        AND ledger.denom <> 'ualpha'
                    GROUP BY ledger.denom
                )
                SELECT
                    DISTINCT
                    base.hard_balance,
                    (base.hard_balance / 10^6) as normal_balance,
                    CASE guild_meta.denom->>'0' 
                        WHEN '' THEN 'uguild.'||guild_meta.id 
                        ELSE guild_meta.denom->>'0' 
                    END as value_smallest,
                    CASE guild_meta.denom->>'6' 
                        WHEN '' THEN 'guild.'||guild_meta.id 
                        ELSE guild_meta.denom->>'6' 
                    END as value_normal,
                    base.denom as denom,
                    guild_meta.id as guild_id,
                    guild_meta.name as guild_name,
                    guild_meta.tag as guild_tag
                FROM 
                    base 
                    LEFT JOIN structs.guild_meta 
                        ON guild_meta.id = TRIM(base.denom,'uguild.') 
                WHERE base.hard_balance > 0
                AND (
                    base.denom ILIKE $2
                    OR guild_meta.name ILIKE $2
                    OR guild_meta.tag ILIKE $2
                )
                LIMIT 25`,
                [playerId, `%${focusedValue}%`]
            );

            result.rows.map(row => {
                    choices.push(
                        {
                            name: `${row.value_smallest || ''} (${row.denom}) ${row.guild_name || 'Unknown Guild'} [${row.guild_tag || 'N/A'}] - Balance: ${row.hard_balance}`,
                            value: `${row.denom}`
                        },
                        {
                            name: `${row.value_normal || ''} (guild.${row.guild_id}) ${row.guild_name || 'Unknown Guild'} [${row.guild_tag || 'N/A'}] - Balance: ${row.normal_balance}`,
                            value: `guild.${row.guild_id}`
                        }
                    )
                }
            )
            await interaction.respond(choices);
        } catch (error) {
            console.error('Error in redeem autocomplete:', error);
            await interaction.respond([]);
        }
    }
}; 