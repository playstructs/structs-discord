const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { EMOJIS } = require('../constants/emojis');
const { handleError } = require('../utils/errors');

/**
 * Help command module
 * @module commands/help
 * @description Displays all available commands and their descriptions
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display all available commands and their descriptions'),

    /**
     * Execute handler for help command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const mainEmbed = new EmbedBuilder()
                .setTitle(`${EMOJIS.CURRENCY.ALPHA} Structs Discord Bot ${EMOJIS.CURRENCY.ALPHA}`)
                .setColor('#0099ff')
                .setDescription('A comprehensive Discord bot for managing your Structs game experience.')
                .addFields(
                    {
                        name: `${EMOJIS.STATUS.INFO} Search & Discovery`,
                        value: '`/search` - Find players, guilds, structs, planets, and more by ID or name\n' +
                               '`/top` - View leaderboards and rankings',
                        inline: false
                    },
                    {
                        name: `${EMOJIS.SYSTEM.MEMBER_DIRECTORY} Player Commands`,
                        value: '`/join` - Join a guild and create your account\n' +
                               '`/station` - View your player profile and stats\n' +
                               '`/explore` - Explore a new planet\n' +
                               '`/send` - Transfer resources to other players\n' +
                               '`/inventory` - View player inventory and balances\n' +
                               '`/player-resume` - Resume your account after spam detection lockout',
                        inline: false
                    },
                    {
                        name: `${EMOJIS.STRUCT.PLANETARY} Struct Commands`,
                        value: '`/struct define` - Define a new structure\n' +
                               '`/struct build` - Complete struct construction\n' +
                               '`/struct activate` - Activate a built struct\n' +
                               '`/struct deactivate` - Deactivate an active struct\n' +
                               '`/struct mine` - Mine resources from a struct\n' +
                               '`/struct refine` - Refine resources in a struct\n' +
                               '`/struct attack` - Attack a target struct\n' +
                               '`/struct defense-clear` - Clear defense systems\n' +
                               '`/struct defense-set` - Set struct protection\n' +
                               '`/struct stealth-activate` - Activate stealth systems\n' +
                               '`/struct stealth-deactivate` - Deactivate stealth systems\n' +
                               '`/struct status` - Check structure status and operations',
                        inline: false
                    },
                    {
                        name: `${EMOJIS.STRUCT.FLEET} Fleet Commands`,
                        value: '`/fleet deploy` - Deploy fleet to a destination planet\n' +
                               '`/fleet return` - Return fleet to your planet\n' +
                               '`/fleet status` - Check fleet status and active raids\n' +
                               '`/raid` - Complete a planet raid and steal available Ore',
                        inline: false
                    },
                    {
                        name: `${EMOJIS.STATUS.INFO} Status Commands`,
                        value: '`/struct status` - Check structure status, operations, and capabilities\n' +
                               '`/fleet status` - Check fleet location, command ship, and raid status\n' +
                               '`/operation status` - List all active operations (builds, mining, refining, raids)',
                        inline: false
                    },
                    {
                        name: `${EMOJIS.CURRENCY.ALPHA} Energy Market`,
                        value: '`/redeem` - Convert Guild Token to Alpha Matter\n' +
                               '`/offer` - Create resource offers for other players\n' +
                               '`/buy` - Accept resource offers from providers\n' +
                               '`/calculate` - Calculate economic values (refine, energy, agreement cost, token value, capacity)',
                        inline: false
                    },
                    {
                        name: `${EMOJIS.SYSTEM.GRID} Energy Administration`,
                        value: '`/allocation create` - Set up Energy allocations\n' +
                               '`/allocation connect` - Link allocations to substations\n' +
                               '`/allocation disconnect` - Deallocate from substations\n' +
                               '`/allocation transfer` - Transfer an allocation to another address\n' +
                               '`/substation create` - Create a new substation\n' +
                               '`/substation player-connect` - Connect a player to substation\n' +
                               '`/substation player-disconnect` - Disconnect a player from substation\n' +
                               '`/infuse` - Add Alpha Matter for Energy Production',
                        inline: false
                    },
                    {
                        name: `${EMOJIS.SYSTEM.GUILD} Guild Administration`,
                        value: '`/guild authorization-status` - Authorize Bot for Guild operations',
                        inline: false
                    },
                    {
                        name: `${EMOJIS.SYSTEM.GRID} GRASS Event Streaming`,
                        value: '`/grass subscribe` - Subscribe to game event notifications\n' +
                               '`/grass unsubscribe` - Unsubscribe from event notifications\n' +
                               '`/grass list` - List all active subscriptions for this channel\n\n' +
                               '**Examples:**\n' +
                               '• `structs.grid.>` - All grid updates\n' +
                               '• `structs.planet.>` - All planet activity\n' +
                               '• `structs.inventory.>` - All inventory transactions\n' +
                               '• `structs.guild.>` - All guild updates',
                        inline: false
                    },
                    {
                        name: '💻 Developer Resources',
                        value: '`/dev compendium` - Links to Structs Compendium documentation\n' +
                               '`/dev repos` - Links to Structs repositories\n' +
                               '`/dev api` - API documentation and quick reference\n' +
                               '`/dev schemas` - Entity schemas and data structures\n' +
                               '`/dev examples` - Code examples and bot implementations\n' +
                               '`/dev quickstart` - Quick start guide for developers',
                        inline: false
                    }
                )
                .setFooter({ text: 'Use /help <command> for detailed information about a specific command' })
                .setTimestamp();

            await interaction.editReply({ embeds: [mainEmbed] });
        } catch (error) {
            const { embed } = handleError(error, 'help command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 