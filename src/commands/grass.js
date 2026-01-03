const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const natsService = require('../services/nats');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createSuccessEmbed, createInfoEmbed } = require('../utils/errors');

/**
 * Grass command module
 * @module commands/grass
 * @description Manages GRASS (Game Real-time Activity Streaming System) event streaming notifications for Discord channels
 */

// Preset subscription patterns
const SUBSCRIPTION_PRESETS = {
    'all-grid': { pattern: 'structs.grid.>', description: 'All grid updates (ore, capacity, load, etc.)' },
    'all-planet': { pattern: 'structs.planet.>', description: 'All planet activity (raids, fleets, structs)' },
    'all-inventory': { pattern: 'structs.inventory.>', description: 'All inventory transactions (sent, received, mined, etc.)' },
    'all-guild': { pattern: 'structs.guild.>', description: 'All guild updates (membership, consensus, meta)' },
    'all-player': { pattern: 'structs.player.>', description: 'All player updates (consensus, meta)' },
    'all-provider': { pattern: 'structs.provider.>', description: 'All provider updates' },
    'all-agreement': { pattern: 'structs.agreement.>', description: 'All agreement updates' },
    'ore-changes': { pattern: 'structs.grid.ore', description: 'Ore hoard changes only' },
    'energy-changes': { pattern: 'structs.grid.capacity', description: 'Energy capacity changes only' },
    'planet-raids': { pattern: 'structs.planet.raid_status', description: 'Planet raid status updates' },
    'fleet-movements': { pattern: 'structs.planet.fleet_', description: 'Fleet arrival, departure, and movement' },
    'struct-events': { pattern: 'structs.planet.struct_', description: 'Struct attacks, defense, and status changes' }
};

// Available event types for discovery
const EVENT_TYPES = {
    'Grid Events': [
        { pattern: 'structs.grid.ore', description: 'Ore hoard changes' },
        { pattern: 'structs.grid.fuel', description: 'Reactor fuel changes' },
        { pattern: 'structs.grid.capacity', description: 'Energy capacity changes' },
        { pattern: 'structs.grid.load', description: 'Energy load changes' },
        { pattern: 'structs.grid.structsLoad', description: 'Structs load changes' },
        { pattern: 'structs.grid.power', description: 'Allocation power changes' },
        { pattern: 'structs.grid.connectionCapacity', description: 'Substation connection capacity' },
        { pattern: 'structs.grid.connectionCount', description: 'Substation connection count' }
    ],
    'Planet Events': [
        { pattern: 'structs.planet.raid_status', description: 'Raid status updates' },
        { pattern: 'structs.planet.fleet_arrive', description: 'Fleet arrivals' },
        { pattern: 'structs.planet.fleet_advance', description: 'Fleet advances' },
        { pattern: 'structs.planet.fleet_depart', description: 'Fleet departures' },
        { pattern: 'structs.planet.struct_attack', description: 'Struct attacks' },
        { pattern: 'structs.planet.struct_defense_add', description: 'Defense systems added' },
        { pattern: 'structs.planet.struct_defense_remove', description: 'Defense systems removed' },
        { pattern: 'structs.planet.struct_status', description: 'Struct status changes' },
        { pattern: 'structs.planet.struct_move', description: 'Struct movements' },
        { pattern: 'structs.planet.struct_block_build_start', description: 'Struct build initiation' },
        { pattern: 'structs.planet.struct_block_ore_mine_start', description: 'Mining initiation' },
        { pattern: 'structs.planet.struct_block_ore_refine_start', description: 'Refining initiation' }
    ],
    'Inventory Events': [
        { pattern: 'structs.inventory.sent', description: 'Resource transfers (sent)' },
        { pattern: 'structs.inventory.infused', description: 'Power infusions' },
        { pattern: 'structs.inventory.defused', description: 'Power defusions' },
        { pattern: 'structs.inventory.mined', description: 'Ore mining' },
        { pattern: 'structs.inventory.refined', description: 'Ore refining' },
        { pattern: 'structs.inventory.seized', description: 'Resource seizures' },
        { pattern: 'structs.inventory.minted', description: 'Token minting' },
        { pattern: 'structs.inventory.burned', description: 'Token burning' }
    ],
    'Guild Events': [
        { pattern: 'structs.guild.guild_consensus', description: 'Guild consensus updates' },
        { pattern: 'structs.guild.guild_meta', description: 'Guild metadata changes' },
        { pattern: 'structs.guild.guild_membership', description: 'Membership applications and changes' }
    ],
    'Player Events': [
        { pattern: 'structs.player.player_consensus', description: 'Player consensus updates' },
        { pattern: 'structs.player.player_meta', description: 'Player metadata changes' }
    ],
    'Other Events': [
        { pattern: 'structs.provider.>', description: 'Provider updates' },
        { pattern: 'structs.agreement.>', description: 'Agreement updates' },
        { pattern: 'consensus.block', description: 'Block height updates' }
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grass')
        .setDescription('Manage GRASS event streaming notifications for this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName('subscribe')
                .setDescription('Subscribe to event notifications')
                .addStringOption(option =>
                    option
                        .setName('subscription')
                        .setDescription('Subscription pattern or preset name')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unsubscribe')
                .setDescription('Unsubscribe from event notifications')
                .addStringOption(option =>
                    option
                        .setName('subscription')
                        .setDescription('Subscription pattern to unsubscribe from')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all active subscriptions for this channel')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('presets')
                .setDescription('View available subscription presets')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('events')
                .setDescription('View available event types and patterns'                )
        ),

    /**
     * Autocomplete handler for grass command
     * @param {Object} interaction - Discord autocomplete interaction
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getFocused - Get focused option value
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand
     * @param {Function} interaction.respond - Respond with autocomplete choices
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const focusedOption = interaction.options.getFocused(true);
        const subcommand = interaction.options.getSubcommand();

        try {
            const choices = [];

            if (subcommand === 'subscribe') {
                // Add presets
                Object.entries(SUBSCRIPTION_PRESETS).forEach(([key, preset]) => {
                    if (key.includes(focusedValue.toLowerCase()) || preset.pattern.includes(focusedValue.toLowerCase())) {
                        choices.push({
                            name: `📋 ${key} - ${preset.description}`,
                            value: preset.pattern
                        });
                    }
                });

                // Add common patterns
                const commonPatterns = [
                    { name: 'All Grid Updates', value: 'structs.grid.>' },
                    { name: 'All Planet Activity', value: 'structs.planet.>' },
                    { name: 'All Inventory Transactions', value: 'structs.inventory.>' },
                    { name: 'All Guild Updates', value: 'structs.guild.>' },
                    { name: 'All Player Updates', value: 'structs.player.>' }
                ];

                commonPatterns.forEach(pattern => {
                    if (pattern.name.toLowerCase().includes(focusedValue.toLowerCase()) || 
                        pattern.value.includes(focusedValue.toLowerCase())) {
                        choices.push({
                            name: `🔔 ${pattern.name}`,
                            value: pattern.value
                        });
                    }
                });

                // If user is typing a custom pattern, add it as an option
                if (focusedValue && !choices.some(c => c.value === focusedValue)) {
                    if (focusedValue.includes('.') || focusedValue.includes('>')) {
                        choices.push({
                            name: `✨ Custom: ${focusedValue}`,
                            value: focusedValue
                        });
                    }
                }
            } else if (subcommand === 'unsubscribe') {
                // Get current subscriptions for this channel
                const subscriptions = await natsService.getChannelSubscriptions(interaction.channelId);
                
                subscriptions.forEach(sub => {
                    if (sub.toLowerCase().includes(focusedValue.toLowerCase())) {
                        const presetName = Object.keys(SUBSCRIPTION_PRESETS).find(
                            key => SUBSCRIPTION_PRESETS[key].pattern === sub
                        );
                        choices.push({
                            name: presetName ? `📋 ${presetName} - ${sub}` : `🔔 ${sub}`,
                            value: sub
                        });
                    }
                });
            }

            // Limit to 25 choices
            await interaction.respond(choices.slice(0, 25));
        } catch (error) {
            console.error('Error in grass autocomplete:', error);
            await interaction.respond([]);
        }
    },

    /**
     * Execute handler for grass command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Object} interaction.channel - Discord channel object
     * @param {string} interaction.channel.id - Channel ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand
     * @param {Function} interaction.options.getString - Get string option values
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channelId = interaction.channelId;
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'subscribe': {
                    const subscription = interaction.options.getString('subscription');
                    try {
                        await natsService.addSubscription(channelId, subscription);
                        
                        // Find preset name if it's a preset
                        const presetName = Object.keys(SUBSCRIPTION_PRESETS).find(
                            key => SUBSCRIPTION_PRESETS[key].pattern === subscription
                        );
                        const presetInfo = presetName ? SUBSCRIPTION_PRESETS[presetName] : null;

                        const embed = createSuccessEmbed(
                            'Subscription Added',
                            presetInfo 
                                ? `Successfully subscribed to **${presetName}** preset.\n\n${presetInfo.description}`
                                : `Successfully subscribed to event notifications.`,
                            [
                                { name: 'Pattern', value: `\`${subscription}\``, inline: false }
                            ]
                        );

                        await interaction.editReply({ embeds: [embed] });
                    } catch (error) {
                        const { embed } = handleError(error, 'grass subscribe', interaction);
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'unsubscribe': {
                    const subscription = interaction.options.getString('subscription');
                    try {
                        await natsService.removeSubscription(channelId, subscription);
                        
                        const embed = createSuccessEmbed(
                            'Subscription Removed',
                            'Successfully unsubscribed from event notifications.',
                            [
                                { name: 'Pattern', value: `\`${subscription}\``, inline: false }
                            ]
                        );

                        await interaction.editReply({ embeds: [embed] });
                    } catch (error) {
                        const { embed } = handleError(error, 'grass unsubscribe', interaction);
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'list': {
                    try {
                        const subscriptions = await natsService.getChannelSubscriptions(channelId);
                        
                        if (subscriptions.length === 0) {
                            const embed = createInfoEmbed(
                                'No Active Subscriptions',
                                'This channel is not subscribed to any event notifications.\n\nUse `/grass subscribe` to add subscriptions.'
                            );
                            await interaction.editReply({ embeds: [embed] });
                        } else {
                            const embed = new EmbedBuilder()
                                .setColor(0x0099ff)
                                .setTitle(`${EMOJIS.STATUS.INFO} Active Subscriptions`)
                                .setDescription(`This channel is subscribed to **${subscriptions.length}** event pattern${subscriptions.length > 1 ? 's' : ''}.`)
                                .setTimestamp();

                            // Group subscriptions by category
                            const grouped = subscriptions.map(sub => {
                                const presetName = Object.keys(SUBSCRIPTION_PRESETS).find(
                                    key => SUBSCRIPTION_PRESETS[key].pattern === sub
                                );
                                return {
                                    pattern: sub,
                                    preset: presetName,
                                    description: presetName ? SUBSCRIPTION_PRESETS[presetName].description : null
                                };
                            });

                            // Add fields for each subscription
                            grouped.forEach((sub, index) => {
                                const name = sub.preset 
                                    ? `📋 ${sub.preset}`
                                    : `🔔 Pattern ${index + 1}`;
                                const value = sub.description 
                                    ? `${sub.description}\n\`${sub.pattern}\``
                                    : `\`${sub.pattern}\``;
                                embed.addFields({ name, value, inline: false });
                            });

                            await interaction.editReply({ embeds: [embed] });
                        }
                    } catch (error) {
                        const { embed } = handleError(error, 'grass list', interaction);
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'presets': {
                    const embed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle(`${EMOJIS.STATUS.INFO} Subscription Presets`)
                        .setDescription('Quick subscription templates for common use cases.')
                        .setTimestamp();

                    Object.entries(SUBSCRIPTION_PRESETS).forEach(([key, preset]) => {
                        embed.addFields({
                            name: `📋 ${key}`,
                            value: `${preset.description}\n\`${preset.pattern}\``,
                            inline: false
                        });
                    });

                    embed.setFooter({ text: 'Use /grass subscribe and type the preset name or pattern' });
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'events': {
                    const embeds = [];
                    
                    // Create main embed
                    const mainEmbed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle(`${EMOJIS.STATUS.INFO} Available Event Types`)
                        .setDescription('Event types you can subscribe to using `/grass subscribe`')
                        .setTimestamp();

                    // Create embeds for each category (Discord has a 25 field limit per embed)
                    Object.entries(EVENT_TYPES).forEach(([category, events]) => {
                        const categoryEmbed = new EmbedBuilder()
                            .setColor(0x0099ff)
                            .setTitle(`${EMOJIS.STATUS.INFO} ${category}`)
                            .setTimestamp();

                        events.forEach(event => {
                            categoryEmbed.addFields({
                                name: event.description,
                                value: `\`${event.pattern}\``,
                                inline: true
                            });
                        });

                        embeds.push(categoryEmbed);
                    });

                    // Send all embeds
                    await interaction.editReply({ embeds: [mainEmbed, ...embeds] });
                    break;
                }
            }
        } catch (error) {
            const { embed } = handleError(error, 'grass command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 