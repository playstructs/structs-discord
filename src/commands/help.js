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
                .setTitle(':alpha:Structs Bot Commands:alpha:')
                .setColor('#0099ff')
                .setDescription('Welcome to Structs! Here are all available commands:')
                .addFields(
                    { 
                        name: '\u200B',
                        value: '/join - Join a guild and create an account\n' +
                              '/station - View your profile\n' +
                              '/search - Find anything! Players, guilds, and more\n' +
                              '/top - View leaderboards\n' +
                              '/send - Transfer resources'
                    },
                    {
                        name: 'Energy Market',
                        value:  '/redeem - Convert Guild Token to Alpha\n' +
                                '/offer - Create resource offers\n' +
                                '/buy - Accept offers'
                    },
                    {
                        name: 'Energy Administration',
                        value:  '/allocate - Set up Energy allocations\n' +
                                '/infuse - Add Alpha Matter for Energy Production\n' +
                                '/connect - Link allocations to substations'
                    },
                    {
                        name: 'Guild Administration',
                        value: '/guild authorization-status - Authorize the Bot for your Guild'
                    }
                )
                .setFooter({ text: 'Type / to see detailed information about each command' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error executing help command:', error);
            await interaction.editReply('An error occurred while displaying the help information.');
        }
    }
}; 