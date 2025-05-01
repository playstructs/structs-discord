const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');

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

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const denom = interaction.options.getString('denom');
            const amount = interaction.options.getNumber('amount');

            // Get player ID from discord ID
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('Player not found. Please ensure you are registered.');
            }

            const playerId = playerResult.rows[0].player_id;

            // Execute the redeem transaction
            await db.query(
                'SELECT signer.tx_guild_bank_redeem($1, $2, $3)',
                [playerId, amount, denom]
            );

            const embed = new EmbedBuilder()
                .setTitle('Guild Bank Redemption')
                .setColor('#00ff00')
                .addFields(
                    { name: 'Denomination', value: denom, inline: true },
                    { name: 'Amount', value: amount.toString(), inline: true }
                )
                .setDescription('Redemption completed successfully!');

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error executing redeem command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            // Get player ID from discord ID
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.respond([]);
            }

            const playerId = playerResult.rows[0].player_id;

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