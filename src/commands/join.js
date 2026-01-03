const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const { handleError, createSuccessEmbed, createWarningEmbed } = require('../utils/errors');
const { EMOJIS } = require('../constants/emojis');

/**
 * Join command module
 * @module commands/join
 * @description Allows players to join a guild and register as a player
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join a guild')
        .addStringOption(option =>
            option
                .setName('guild')
                .setDescription('Select the guild to join')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    /**
     * Autocomplete handler for join command
     * @param {Object} interaction - Discord autocomplete interaction
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getFocused - Get focused option value
     * @param {Function} interaction.respond - Respond with autocomplete choices
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const choices = [];
        
        try {
            // If the input is empty, return helpful default suggestions
            if (!focusedValue) {
                choices.push(
                    { name: '🔍 Type to search for a guild', value: 'search' }
                );
            } else {
                const result = await db.query(
                    `
                    WITH base AS (
                        SELECT guild_meta.id as name, guild_meta.id as value from guild_meta where this_infrastructure
                        UNION
                        SELECT guild_meta.name ||'('||guild_meta.id||')' as name, guild_meta.id as value FROM structs.guild_meta WHERE this_infrastructure
                        UNION 
                        SELECT guild_meta.tag ||'('||guild_meta.id||')' as name, guild_meta.id as value  FROM structs.guild_meta WHERE this_infrastructure
                    )
                    SELECT * FROM base
                    WHERE name ILIKE $1
                    LIMIT 25`,
                    [`%${focusedValue}%`]
                );

                // Add visual indicators for guilds
                result.rows.forEach(row => {
                    choices.push({
                        name: '🏰 ' + row.name,
                        value: row.value
                    });
                });
                
                // If no results were found, add a helpful message
                if (choices.length === 0) {
                    choices.push({ 
                        name: '🔍 No guilds found. Try a different search term.', 
                        value: 'no-results' 
                    });
                }
            }
            
            // Ensure we're responding with valid choices
            if (choices.length > 0) {
                await interaction.respond(choices);
            } else {
                // Fallback if somehow we have no choices
                await interaction.respond([
                    { name: '🔍 No guilds found', value: 'no-results' }
                ]);
            }
        } catch (error) {
            console.error('Error in join autocomplete:', error);
            // Send a fallback response instead of an empty array
            await interaction.respond([
                { name: '❌ Error occurred during search', value: 'error' }
            ]);
        }
    },

    /**
     * Execute handler for join command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {string} interaction.user.username - Discord username
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getString - Get string option value ('guild')
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guildIdentifier = interaction.options.getString('guild');
            let guildId;

            // Get guild ID from tag or use provided ID
            if (guildIdentifier === 'no-results' || guildIdentifier === 'error') {
                return await interaction.editReply({ 
                    embeds: [createWarningEmbed(
                        'Invalid Selection',
                        'Please select a valid guild from the autocomplete suggestions.'
                    )]
                });
            } else if (guildIdentifier.includes('-')) {
                guildId = guildIdentifier;
            } else {
                const guildResult = await db.query(
                    'SELECT id FROM structs.guild_meta WHERE tag = $1',
                    [guildIdentifier]
                );
                if (guildResult.rows.length === 0) {
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Guild Not Found',
                            'The specified guild was not found. Please check the guild tag or ID and try again.'
                        )]
                    });
                }
                guildId = guildResult.rows[0].id;
            }

            const discordId = interaction.user.id;
            const discordUsername = interaction.user.username;

            // Check if player already exists
            const playerCheck = await db.query(
                'SELECT * FROM structs.player_discord WHERE discord_id = $1',
                [discordId]
            );

            if (playerCheck.rows.length > 0) {
                return await interaction.editReply({ 
                    embeds: [createWarningEmbed(
                        'Already Registered',
                        'You are already registered as a player. Use `/station` to view your profile.'
                    )]
                });
            }

            // Check if player already has a pending join request
            const pendingCheck = await db.query(
                'SELECT * FROM signer.role WHERE role.id in (select player_discord.role_id FROM structs.player_discord where player_discord.discord_id = $1) and role.status != $2',
                [discordId, 'ready']
            );

            if (pendingCheck.rows.length > 0) {
                return await interaction.editReply({ 
                    embeds: [createWarningEmbed(
                        'Pending Request',
                        'You already have a pending join request. Please wait for it to be processed before submitting another request.'
                    )]
                });
            }

            // Insert the join request
            await db.query(
                'INSERT INTO structs.player_discord(guild_id, discord_id, discord_username) VALUES ($1, $2, $3)',
                [guildId, discordId, discordUsername]
            );

            const embed = createSuccessEmbed(
                'Join Request Submitted',
                'Your join request has been submitted successfully. The backend process will handle your registration.',
                [
                    { name: 'Guild ID', value: guildId, inline: true },
                    { name: 'Discord Username', value: discordUsername, inline: true }
                ]
            );
            embed.setFooter({ text: 'You will be able to use more commands once your registration is complete.' });

            return await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'join command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 