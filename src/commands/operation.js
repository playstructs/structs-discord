const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createWarningEmbed } = require('../utils/errors');
const { getPlayerIdWithValidation } = require('../utils/player');
const { getActiveOperations } = require('../utils/status');
const { createEnhancedEmbed, createSeparatorField, EMBED_COLORS } = require('../utils/embedFormatter');
const { formatNumber, createSeparator } = require('../utils/designSystem');

/**
 * Operation command module
 * @module commands/operation
 * @description Check status of all active operations (builds, mining, refining, raids)
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('operation')
        .setDescription('Check status of active operations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('List all active operations')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Filter by operation type')
                        .addChoices(
                            { name: 'Build', value: 'build' },
                            { name: 'Mine', value: 'mine' },
                            { name: 'Refine', value: 'refine' },
                            { name: 'Raid', value: 'raid' }
                        )
                )),

    /**
     * Execute handler for operation command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand
     * @param {Function} interaction.options.getString - Get string option value ('type')
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'status') {
                const playerResult = await getPlayerIdWithValidation(
                    interaction.user.id,
                    'You are not registered as a player. Please use `/join` to join a guild first.'
                );

                if (playerResult.error) {
                    return await interaction.editReply({ embeds: [playerResult.error] });
                }

                const playerId = playerResult.playerId;
                const filterType = interaction.options.getString('type');

                const operations = await getActiveOperations(playerId, filterType);

                if (operations.length === 0) {
                    const filterText = filterType ? ` of type '${filterType}'` : '';
                    return await interaction.editReply({
                        embeds: [createWarningEmbed(
                            'No Active Operations',
                            `You do not have any active operations${filterText}.`
                        )]
                    });
                }

                // Group operations by type
                const grouped = {
                    build: [],
                    mine: [],
                    refine: [],
                    raid: []
                };

                for (const op of operations) {
                    grouped[op.type].push(op);
                }

                const fields = [];

                // Add build operations
                if (grouped.build.length > 0) {
                    const buildList = grouped.build.map(op => 
                        `• **${op.entityId}** ${op.entityType}\n` +
                        `  📍 Started: Block ${formatNumber(op.startBlock)} | ⏱️ Elapsed: ${formatNumber(op.blocksElapsed || 0)} blocks`
                    ).join('\n\n');
                    fields.push({
                        name: `🏗️ Building (${grouped.build.length})`,
                        value: buildList,
                        inline: false
                    });
                }

                // Add mining operations
                if (grouped.mine.length > 0) {
                    if (fields.length > 0) fields.push(createSeparatorField());
                    const mineList = grouped.mine.map(op => 
                        `• **${op.entityId}** ${op.entityType}\n` +
                        `  📍 Started: Block ${formatNumber(op.startBlock)} | ⏱️ Elapsed: ${formatNumber(op.blocksElapsed || 0)} blocks`
                    ).join('\n\n');
                    fields.push({
                        name: `⛏️ Mining (${grouped.mine.length})`,
                        value: mineList,
                        inline: false
                    });
                }

                // Add refining operations
                if (grouped.refine.length > 0) {
                    if (fields.length > 0) fields.push(createSeparatorField());
                    const refineList = grouped.refine.map(op => 
                        `• **${op.entityId}** ${op.entityType}\n` +
                        `  📍 Started: Block ${formatNumber(op.startBlock)} | ⏱️ Elapsed: ${formatNumber(op.blocksElapsed || 0)} blocks`
                    ).join('\n\n');
                    fields.push({
                        name: `🔧 Refining (${grouped.refine.length})`,
                        value: refineList,
                        inline: false
                    });
                }

                // Add raid operations
                if (grouped.raid.length > 0) {
                    if (fields.length > 0) fields.push(createSeparatorField());
                    const raidList = grouped.raid.map(op => 
                        `• **Fleet ${op.entityId}** on Planet ${op.targetPlanet}\n` +
                        `  📍 Started: Block ${formatNumber(op.startBlock)} | ⏱️ Elapsed: ${formatNumber(op.blocksElapsed || 0)} blocks`
                    ).join('\n\n');
                    fields.push({
                        name: `⚔️ Raiding (${grouped.raid.length})`,
                        value: raidList,
                        inline: false
                    });
                }

                const embed = createEnhancedEmbed({
                    title: `${EMOJIS.STATUS.INFO} Active Operations`,
                    color: EMBED_COLORS.primary,
                    fields,
                    footer: `Total: ${operations.length} active operation(s)`
                });

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            const { embed } = handleError(error, 'operation command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

