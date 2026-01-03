const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createSuccessEmbed, createWarningEmbed } = require('../utils/errors');
const { getPlayerId, getPlayerIdWithValidation } = require('../utils/player');

/**
 * Send command module
 * @module commands/send
 * @description Allows players to send resources (Alpha Matter, guild tokens) to other players via player ID, Discord mention, or wallet address
 */
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

    /**
     * Autocomplete handler for send command
     * @param {Object} interaction - Discord autocomplete interaction
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getFocused - Get focused option value and name
     * @param {Function} interaction.respond - Respond with autocomplete choices
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const focusedOption = interaction.options.getFocused(true);
        const choices = [];
        
        try {
            // Get player ID (no validation needed for autocomplete)
            const playerId = await getPlayerId(interaction.user.id);
            
            if (!playerId) {
                return await interaction.respond([]);
            }

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

    /**
     * Execute handler for send command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {string} interaction.user.username - Discord username
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getString - Get string option value
     * @param {Function} interaction.options.getNumber - Get number option value
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const resource = interaction.options.getString('resource');
            const recipient = interaction.options.getString('to');
            const amount = interaction.options.getNumber('amount');

            // Get player ID with validation
            const playerResult = await getPlayerIdWithValidation(
                interaction.user.id,
                'You are not registered. Please use `/join` to register first.'
            );
            
            if (playerResult.error) {
                return await interaction.editReply({ embeds: [playerResult.error] });
            }

            const playerId = playerResult.playerId;

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
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Recipient Not Found',
                            'The recipient is not registered. Make sure they have joined a guild using `/join`.'
                        )]
                    });
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
                return await interaction.editReply({ 
                    embeds: [createWarningEmbed(
                        'Invalid Recipient Format',
                        'Please use one of the following formats:\n• Player ID (e.g., `1-123`)\n• Discord mention (e.g., `@username`)\n• Wallet address (e.g., `structs1...`)'
                    )]
                });
            }

            // Get the recipient's address if we have their ID
            if (!recipientId && recipientAddress) {
                const { getPlayerIdFromAddress } = require('../utils/player');
                const foundPlayerId = await getPlayerIdFromAddress(recipientAddress);

                if (!foundPlayerId) {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Address Not Found',
                            'The recipient address was not found in the system.'
                        )]
                    });
                }

                recipientId = foundPlayerId;
            }

            // Execute the send transaction
            await db.query(
                'SELECT signer.tx_bank_send($1, $2, $3, $4)',
                [playerId, amount, resource, recipientId || recipientAddress]
            );

            // Create success embed
            const embed = createSuccessEmbed(
                'Transfer Request Submitted',
                'Your resource transfer request has been submitted for processing.',
                [
                    { name: 'From', value: `${senderUsername} (${playerId})`, inline: true },
                    { name: 'To', value: `${recipientUsername || 'Address'} (${recipientId || recipientAddress})`, inline: true },
                    { name: 'Amount', value: `${amount} ${resource}`, inline: true }
                ]
            );
            embed.setFooter({ text: 'Check your balance with /search or /station' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const { embed } = handleError(error, 'send command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 