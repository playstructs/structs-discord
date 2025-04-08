const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send resources to another player')
        .addStringOption(option =>
            option
                .setName('resource')
                .setDescription('The resource to send')
                .setRequired(true)
                .setAutocomplete(false)
        )
        .addStringOption(option =>
            option
                .setName('to')
                .setDescription('Recipient (player ID, @username, or address)')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addNumberOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to send')
                .setRequired(true)
                .setMinValue(0)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const choices = [];
        
        try {
            // If the input is empty, return some default suggestions
            if (!focusedValue) {
                choices.push(
                    { name: '👤 Enter a player ID (e.g., 1-123)', value: '1-' },
                    { name: '👤 Mention a player (@username)', value: '@' },
                    { name: '🔒 Enter a wallet address', value: 'structs' }
                );
            } else {
                // Use the provided SQL query to get a list of potential recipients
                const result = await db.query(
                    `SELECT id, id FROM (
                        SELECT id, id FROM structs.player 
                        UNION 
                        SELECT '@' || player_discord.discord_username || '(' || player_discord.discord_id || ')', player_discord.player_id FROM structs.player_discord 
                        UNION 
                        SELECT player_address.address, player_address.player_id FROM structs.player_address
                    ) AS recipients
                    WHERE id ILIKE $1
                    LIMIT 25`,
                    [`%${focusedValue}%`]
                );
                
                // Add visual indicators based on the type of recipient
                result.rows.forEach(row => {
                    let name = row.id;
                    let prefix = '';
                    
                    // Add appropriate emoji based on the type of recipient
                    if (name.startsWith('@')) {
                        prefix = '👤 '; // Discord user
                    } else if (name.startsWith('structs')) {
                        prefix = '🔒 '; // Wallet address
                    } else if (name.includes('-')) {
                        prefix = '👤 '; // Player ID
                    }
                    
                    choices.push({ name: prefix + name, value: row.id });
                });
            }
            
            await interaction.respond(choices);
        } catch (error) {
            console.error('Autocomplete error:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const resource = interaction.options.getString('resource');
 
            const recipient = interaction.options.getString('to');
            const amount = interaction.options.getNumber('amount');

            // Get the player ID from the Discord username
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('❌ You are not registered. Please register first.');
            }

            const playerId = playerResult.rows[0].player_id;


            // Determine the recipient ID based on the input format
            let recipientId;
            
            if (recipient.startsWith('<@')) {
                // It's a Discord mention
                const discordId = recipient.replace(/[<@!>]/g, '');
                const discordResult = await db.query(
                    'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                    [discordId]
                );
                
                if (discordResult.rows.length === 0) {
                    return await interaction.editReply('❌ Recipient not found or not registered.');
                }
                
                recipientId = discordResult.rows[0].player_id;
            } else if (recipient.startsWith('0x')) {
                // It's a wallet address
                const addressResult = await db.query(
                    'SELECT player_id FROM structs.player_address WHERE address = $1',
                    [recipient]
                );
                
                if (addressResult.rows.length === 0) {
                    return await interaction.editReply('❌ Recipient not found or not registered.');
                }
                
                recipientId = addressResult.rows[0].player_id;
            } else if (recipient.includes('-')) {
                // It's a player ID
                recipientId = recipient;
            } else {
                return await interaction.editReply('❌ Invalid recipient format. Use a player ID, @username, or wallet address.');
            }

            // Create the wire transaction
            const result = await db.query(
                'SELECT signer.tx_wire($1, $2, $3, $4)',
                [playerId, amount, resource, recipientId]
            );

            if (result.rows[0].tx_wire) {
                return await interaction.editReply(`✅ Resources sent successfully! Transaction ID: ${result.rows[0].tx_wire}`);
            } else {
                return await interaction.editReply('❌ Failed to send resources. Please try again.');
            }
        } catch (error) {
            console.error(error);
            return await interaction.editReply('❌ There was an error processing your request.');
        }
    }
}; 