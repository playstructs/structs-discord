const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { EMOJIS } = require('../constants/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display all available commands'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const embed = new EmbedBuilder()
                .setTitle(`${EMOJIS.CURRENCY.ALPHA} Structs Bot Commands ${EMOJIS.CURRENCY.ALPHA}`)
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
                                    '/allocation create - Set up Energy allocations\n' +
                                    '/allocation connect - Link allocations to substations\n' +
                                    '/infuse - Add Alpha Matter for Energy Production\n' +
                                    '## Guild Administration\n' +
                                    '/guild authorization-status - Authorize the Bot for your Guild'
                ).setFooter({ text: 'Type / to see detailed information about each command' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error executing help command:', error);
            await interaction.editReply(`${EMOJIS.STATUS.ERROR} An error occurred while displaying the help information.`);
        }
    }
}; 