const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guild')
        .setDescription('Guild-related commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('authorization-status')
                .setDescription('Check guild authorization and permission status')
                .addStringOption(option =>
                    option
                        .setName('guild')
                        .setDescription('Guild ID or tag')
                        .setRequired(true)
                        .setAutocomplete(true)
                )),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'authorization-status') {
                const guildIdentifier = interaction.options.getString('guild');

                // Get guild ID from tag or use provided ID
                let guildId;
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

                // Check join status
                const joinResult = await db.query(
                    'SELECT primary_address, pubkey, signature FROM structs.player_external_pending WHERE guild_id = $1',
                    [guildId]
                );

                // Check permissions
                const permissionResult = await db.query(
                    `SELECT bit_or(permission.val) as val, permission.object_type 
                     FROM structs.permission 
                     WHERE player_id IN (
                         SELECT player_id 
                         FROM signer.role 
                         WHERE guild_id = $1
                     ) 
                     GROUP BY object_type`,
                    [guildId]
                );

                // Create embed
                const embed = new EmbedBuilder()
                    .setTitle('Guild Authorization Status')
                    .setColor('#0099ff');

                // Add join status
                if (joinResult.rows.length > 0) {
                    embed.addFields(
                        { name: 'Join Status', value: 'Pending Authorization', inline: false },
                        { name: 'Proxy Join Address', value: joinResult.rows[0].primary_address, inline: true },
                        { name: 'Public Key', value: joinResult.rows[0].pubkey, inline: true },
                        { name: 'Signature', value: joinResult.rows[0].signature, inline: true }
                    );
                } else {
                    embed.addFields(
                        { name: 'Join Status', value: 'Authorization Complete', inline: false }
                    );
                }

                // Add permission status
                const permissionStatus = [];
                let isFullySetup = true;

                for (const row of permissionResult.rows) {
                    const val = parseInt(row.val);
                    const objectType = row.object_type;
                    const permissions = [];

                    // Check each permission bit
                    if (val & 1) permissions.push('Play');
                    if (val & 2) permissions.push('Update');
                    if (val & 4) permissions.push('Delete');
                    if (val & 8) permissions.push('Assets');
                    if (val & 16) permissions.push('Associations');
                    if (val & 32) permissions.push('Grid');
                    if (val & 64) permissions.push('Permissions');

                    // Check if guild is fully setup
                    if (objectType === 'guild' && !(val & 16)) {
                        isFullySetup = false;
                    }
                    if (objectType === 'substation' && !(val & 48)) {
                        isFullySetup = false;
                    }

                    permissionStatus.push(`${objectType}: ${permissions.join(', ')}`);
                }

                embed.addFields(
                    { name: 'Permission Status', value: permissionStatus.join('\n') || 'No permissions found', inline: false },
                    { name: 'Setup Status', value: isFullySetup ? '✅ Fully Setup' : '❌ Not Fully Setup', inline: false }
                );

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error executing guild command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'authorization-status' && focusedValue.name === 'guild') {
            try {
                const result = await db.query(
                    `SELECT id, tag, name 
                     FROM structs.guild_meta 
                     WHERE id::text ILIKE $1 
                     OR tag ILIKE $1 
                     OR name ILIKE $1
                     LIMIT 25`,
                    [`%${focusedValue}%`]
                );

                await interaction.respond(
                    result.rows.map(row => ({
                        name: `${row.name} (${row.tag})`,
                        value: row.id
                    }))
                );
            } catch (error) {
                console.error('Error in guild autocomplete:', error);
            }
        }
    }
}; 