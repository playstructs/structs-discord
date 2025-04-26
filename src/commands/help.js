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
                .setDescription(
                    '/search - Find anything! Players, guilds, and more\n' +
                    '/top - View leaderboards\n' +
                    '## Player Commands\n' +
                    '/join - Join a guild and create an account\n' +
                    '/station - View your profile\n' +
                    '/explore - Explore a new planet\n' +
                    '/send - Transfer resources\n' +
                    '/player-resume - Resume your player account after spam detection lockout\n' +
                    '## Struct Commands\n' +
                    '/struct define - Define a new struct\n' +
                    '/struct build - Complete struct construction\n' +
                    '/struct activate - Activate a built struct\n' +
                    '/struct deactivate - Deactivate an active struct\n' +
                    '/struct mine - Mine resources from a struct\n' +
                    '/struct refine - Refine resources in a struct\n' +
                    '/struct attack - Attack a target struct\n' +
                    '/struct defense-clear - Clear defense systems\n' +
                    '/struct defense-set - Set struct protection\n' +
                    '/struct stealth-activate - Activate stealth systems\n' +
                    '/struct stealth-deactivate - Deactivate stealth systems\n' +
                    '## Fleet Commands\n' +
                    '/fleet deploy - Deploy fleet to destination\n' +
                    '/fleet return - Return fleet to planet\n' +
                    '/raid - Complete a planet raid and steal available Ore\n' +
                    '## Energy Market\n' +
                    '/redeem - Convert Guild Token to Alpha\n' +
                    '/offer - Create resource offers\n' +
                    '/buy - Accept offers\n' +
                    '## Energy Administration\n' +
                    '/allocation create - Set up Energy allocations\n' +
                    '/allocation connect - Link allocations to substations\n' +
                    '/allocation disconnect - Remove an allocations from substations\n' +
                    '/allocation transfer - Transfer an allocation to another player\n' +
                    '/substation create - Create a new substation\n' +
                    '/substation player-connect - Connect a player to a substation\n' +
                    '/substation player-disconnect - Disconnect a player from a substation\n' +
                    '/infuse - Add Alpha Matter for Energy Production\n' +
                    '## Guild Administration\n' +
                    '/guild authorization-status - Authorize the Bot for your Guild'
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error executing help command:', error);
            await interaction.editReply(`${EMOJIS.STATUS.ERROR} An error occurred while displaying the help information.`);
        }
    }
}; 