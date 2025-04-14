const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display all available commands'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const embed = new EmbedBuilder()
                .setTitle(':alpha: Structs Bot Commands :alpha:')
                .setColor('#0099ff')
                .setDescription(    '/join - Join a guild and create an account\n' +
                                    '/station - View your profile\n' +
                                    '/search - Find anything! Players, guilds, and more\n' +
                                    '/top - View leaderboards\n' +
                                    '/send - Transfer resources\n' +
                                    '## Energy Market\n' +
                                    '/redeem - Convert Guild Token to Alpha\n' +
                                    '/offer - Create resource offers\n' +
                                    '/buy - Accept offers\n' +
                                    '## Energy Administration\n' +
                                    '/allocate - Set up Energy allocations\n' +
                                    '/infuse - Add Alpha Matter for Energy Production\n' +
                                    '/connect - Link allocations to substations\n' +
                                    '## Guild Administration\n' +
                                    '/guild authorization-status - Authorize the Bot for your Guild'
                ).setFooter({ text: 'Type / to see detailed information about each command' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error executing help command:', error);
            await interaction.editReply('An error occurred while displaying the help information.');
        }
    }
}; 