const { SlashCommandBuilder } = require('@discordjs/builders');
const { fetchPlayerData } = require('../queries/structs');
const { createEmbeds } = require('../embeds/structs');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createWarningEmbed } = require('../utils/errors');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('station')
        .setDescription('View your player profile and information'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const discordId = interaction.user.id;
            
            // Fetch player data using Discord ID
            const data = await fetchPlayerData.byDiscordId(discordId);
            
            if (!data.rows || data.rows.length === 0) {
                return await interaction.editReply({ 
                    embeds: [createWarningEmbed(
                        'Not Registered',
                        'You are not registered as a player. Use `/join` to register with a guild first.'
                    )]
                });
            }

            const playerId = data.rows[0].player_id;
            
            // Create and send the player embed
            const embeds = await createEmbeds.player(data.rows[0]);
            
            // Fetch player inventory data
            const inventoryResult = await db.query(
                `WITH base AS (select
                    sum(case
                            when ledger.direction = 'debit' then ledger.amount_p * -1
                            ELSE ledger.amount_p END) as hard_balance,
                    denom                             as denom
                from structs.ledger,
                    structs.player_address
                WHERE
                    player_address.address = ledger.address
                    and player_address.player_id = $1
                GROUP BY ledger.denom
                ), expanded as (
                SELECT
                base.hard_balance  as token_amount,
                CASE denom WHEN 'ualpha' THEN base.hard_balance WHEN 'ore' THEN 0 ELSE (SELECT guild_bank.ratio * base.hard_balance FROM view.guild_bank where guild_bank.denom = base.denom) END as alpha_value,
                denom
                FROM base
                )
                select
                    expanded.token_amount,
                    structs.UNIT_DISPLAY_FORMAT(expanded.token_amount, denom) as display_token_amount,
                    expanded.alpha_value,
                    structs.UNIT_DISPLAY_FORMAT(expanded.alpha_value, 'ualpha') as display_alpha_value,
                    denom
                from
                    expanded;`,
                [playerId]
            );
            
            // Create inventory embed
            const inventoryEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${EMOJIS.STRUCT.CMD} Inventory for ${data.rows[0].discord_username} (${playerId})`)
                .setDescription('Player inventory and token balances')
                .setTimestamp()
                .setFooter({ text: 'Structs Discord Bot' });
            
            // Add inventory items to the embed
            if (inventoryResult.rows.length === 0) {
                inventoryEmbed.addFields({ name: 'No Inventory', value: 'This player has no inventory items.' });
            } else {
                
                // Add each token to the embed
                inventoryResult.rows.forEach(row => {
                    if (row.token_amount !== 0) {
                        inventoryEmbed.addFields({ 
                            name: `${row.display_token_amount}` , 
                            value: `(${row.token_amount} ${row.denom})`,
                            inline: false 
                        });
                    }
                });
            }
            
            // Add inventory embed to the response
            embeds.push(inventoryEmbed);
            
            return await interaction.editReply({ embeds });

        } catch (error) {
            const { embed } = handleError(error, 'station command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 