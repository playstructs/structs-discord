const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send resources to another player')
        .addStringOption(option =>
            option
                .setName('resource')
                .setDescription('The resource to send')
                .setRequired(true)
                .setAutocomplete(true)
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
        const focusedOption = interaction.options.getFocused(true);
        const choices = [];
        
        try {
            // Get player ID from Discord username
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.respond([]);
            }

            const playerId = playerResult.rows[0].player_id;

            if (focusedOption.name === 'resource') {
                // Handle resource autocomplete using the provided SQL query
                const result = await db.query(
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
                        and ledger.denom <> 'ualpha'
                    GROUP BY ledger.denom
                    )    SELECT
                    distinct
                    CASE guild_meta.denom->>'0' WHEN '' THEN 'uguild.'||guild_meta.id ELSE guild_meta.denom->>'0' END as value_smallest,
                    CASE guild_meta.denom->>'6' WHEN '' THEN 'guild.'||guild_meta.id ELSE guild_meta.denom->>'6' END as value_normal,
                    base.denom,
                    guild_meta.id as guild_id,
                    guild_meta.name as guild_name,
                    guild_meta.tag as guild_tag
                    FROM 
                        base 
                        left join structs.guild_meta 
                            on guild_meta.id = trim(base.denom,'uguild.') 
                    where base.hard_balance > 0;`,
                    [playerId]
                );

                choices.push(
                    { name: 'alpha', value: 'alpha' },
                    { name: 'ualpha', value: 'ualpha' }
                );

                // Process the results according to the specified format
                result.rows.forEach(row => {
                    // For guild tokens, add all four format options
                    choices.push(
                        {
                            name: `${row.value_smallest} (uguild.${row.guild_id}) - ${row.guild_name}`,
                            value: `uguild.${row.guild_id}`
                        },
                        {
                            name: `uguild.${row.guild_id} (${row.value_smallest}) - ${row.guild_name}`,
                            value: `uguild.${row.guild_id}`
                        },
                        {
                            name: `${row.value_normal} (guild.${row.guild_id}) - ${row.guild_name}`,
                            value: `guild.${row.guild_id}`
                        },
                        {
                            name: `guild.${row.guild_id} (${row.value_normal}) - ${row.guild_name}`,
                            value: `guild.${row.guild_id}`
                        }
                    );

                });
                
                // Filter choices based on user input if provided
                const filteredChoices = focusedValue 
                    ? choices.filter(choice => 
                        choice.name.toLowerCase().includes(focusedValue.toLowerCase()) || 
                        choice.value.toLowerCase().includes(focusedValue.toLowerCase())
                    )
                    : choices;
                
                // Limit to 25 choices
                await interaction.respond(filteredChoices.slice(0, 25));
            } else if (focusedOption.name === 'to') {
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
                        `WITH base AS (
                            SELECT id as name, id as value FROM structs.player 
                            UNION 
                            SELECT '@' || player_discord.discord_username || '(' || player_discord.discord_id || ')' as name, player_discord.player_id as value FROM structs.player_discord 
                            UNION 
                            SELECT player_address.address as name, player_address.player_id as value FROM structs.player_address
                        )
                        SELECT * FROM base
                        WHERE name ILIKE $1
                        LIMIT 25`,
                        [`%${focusedValue}%`]
                    );
                    
                    // Add visual indicators based on the type of recipient
                    result.rows.forEach(row => {
                        let name = row.name;
                        let prefix = '';
                        
                        // Add appropriate emoji based on the type of recipient
                        if (name.startsWith('@')) {
                            prefix = '👤 '; // Discord user
                        } else if (name.startsWith('structs')) {
                            prefix = '🔒 '; // Wallet address
                        } else if (name.includes('-')) {
                            prefix = '👤 '; // Player ID
                        }
                        
                        choices.push({ name: prefix + name, value: row.value });
                    });
                }
                
                await interaction.respond(choices);
            }
        } catch (error) {
            console.error('Autocomplete error:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

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
                return await interaction.editReply(`${EMOJIS.STATUS.ERROR} You are not registered. Please register first.`);
            }

            const playerId = playerResult.rows[0].player_id;

            // Get sender's Discord username
            const senderUsername = interaction.user.username;

            // Determine the recipient ID based on the input format
            let recipientId;
            let recipientAddress;
            let recipientUsername;

            if (recipient.startsWith('<@')) {
                // It's a Discord mention
                const discordId = recipient.replace(/[<@!>]/g, '');
                const recipientResult = await db.query(
                    'SELECT player_id, discord_username FROM structs.player_discord WHERE discord_id = $1',
                    [discordId]
                );

                if (recipientResult.rows.length === 0) {
                    return await interaction.editReply(`${EMOJIS.STATUS.ERROR} Recipient not found. Make sure they are registered.`);
                }

                recipientId = recipientResult.rows[0].player_id;
                recipientUsername = recipientResult.rows[0].discord_username;
            } else if (recipient.includes('-')) {
                // It's a player ID
                recipientId = recipient;
                const recipientResult = await db.query(
                    'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                    [recipientId]
                );
                recipientUsername = recipientResult.rows[0]?.discord_username || 'Unknown';
            } else if (recipient.startsWith('structs')) {
                // It's a wallet address
                recipientAddress = recipient;
            } else {
                return await interaction.editReply(`${EMOJIS.STATUS.ERROR} Invalid recipient format. Use a player ID, @mention, or wallet address.`);
            }

            // Get the recipient's address if we have their ID
            if (!recipientId && recipientAddress) {
                const addressResult = await db.query(
                    'SELECT player_id FROM structs.player_address WHERE address = $1 LIMIT 1',
                    [recipientAddress]
                );

                if (addressResult.rows.length === 0) {
                    return await interaction.editReply(`${EMOJIS.STATUS.ERROR} Recipient address not found.`);
                }

                recipientId = addressResult.rows[0].player_id;
            }

            // Send the resources
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Transfer Request Submitted')
                .setDescription('Your resource transfer request has been submitted for processing.')
                .addFields(
                    { name: 'From', value: `${senderUsername} (${playerId})`, inline: true },
                    { name: 'To', value: `${recipientUsername || 'Address'} (${recipientId || recipientAddress})`, inline: true },
                    { name: 'Amount', value: `${amount} ${resource}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Check your balance with /search or /station' });

            await interaction.editReply({ 
                content: `${EMOJIS.STATUS.SUCCESS} Transfer request submitted!`,
                embeds: [embed]
            });

            const result = await db.query(
                'SELECT signer.tx_bank_send($1, $2, $3, $4)',
                [playerId, amount, resource, recipientId]
            );

            return await interaction.editReply({ 
                content: `${EMOJIS.STATUS.SUCCESS} Resources sent!`,
                embeds: [embed]
            });

        } catch (error) {
            console.error('Error executing send command:', error);
            await interaction.editReply(`${EMOJIS.STATUS.ERROR} An error occurred while processing your transfer request.`);
        }
    }
}; 