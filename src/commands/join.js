const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');

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
            
            // Log the choices for debugging
            console.log(`Join autocomplete choices for "${focusedValue}":`, choices);
            
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

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guildIdentifier = interaction.options.getString('guild');
            let guildId;

            // Get guild ID from tag or use provided ID
            if (guildIdentifier == 'no-results') {
                return await interaction.editReply('Error, no selection made');
            } else if (guildIdentifier.includes('-')) {
                guildId = guildIdentifier;
            } else {
                const guildResult = await db.query(
                    'SELECT id FROM structs.guild_meta WHERE tag = $1',
                    [guildIdentifier]
                );
                if (guildResult.rows.length === 0) {
                    return await interaction.editReply('Guild not found.');
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
                return await interaction.editReply('You are already registered as a player.');
            }

            // Check if player already has a pending join request
            const pendingCheck = await db.query(
                'SELECT * FROM signer.role WHERE role.id in (select player_discord.role_id FROM structs.player_discord where player_discord.discord_id = $1) and role.status != $2',
                [discordId, 'ready']
            );

            if (pendingCheck.rows.length > 0) {
                return await interaction.editReply('You already have a pending join request. Please wait for it to be processed.');
            }

            // Insert the join request
            await db.query(
                'INSERT INTO structs.player_discord(guild_id, discord_id, discord_username) VALUES ($1, $2, $3)',
                [guildId, discordId, discordUsername]
            );

            return await interaction.editReply('Your join request has been submitted. The backend process will handle your registration. You will be able to use more commands once your registration is complete.');
        } catch (error) {
            console.error('Error handling guild join:', error);
            return await interaction.editReply('An error occurred while processing your join request.');
        }
    }
}; 