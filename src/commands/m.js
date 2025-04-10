const { SlashCommandBuilder } = require('@discordjs/builders');
const { fetchPlayerData } = require('../queries/structs');
const { createEmbeds } = require('../embeds/structs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('m')
        .setDescription('View your player profile and information'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const discordId = interaction.user.id;
            
            // Fetch player data using Discord ID
            const data = await fetchPlayerData.byDiscordId(discordId);
            
            if (!data.rows || data.rows.length === 0) {
                return await interaction.editReply('❌ You are not registered as a player. Use `/join` to register with a guild.');
            }

            // Create and send the player embed
            const embeds = await createEmbeds.player(data.rows[0]);
            return await interaction.editReply({ embeds });

        } catch (error) {
            console.error('Error in /m command:', error);
            return await interaction.editReply('❌ There was an error fetching your player information. Please try again later.');
        }
    }
}; 