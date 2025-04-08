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

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guildIdentifier = interaction.options.getString('guild');
            let guildId;

            // Get guild ID from tag or use provided ID
            if (guildIdentifier.includes('-')) {
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