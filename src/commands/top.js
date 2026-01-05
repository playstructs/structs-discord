const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { handleError, createWarningEmbed } = require('../utils/errors');
const { createLeaderboardEmbed, EMBED_COLORS } = require('../utils/embedFormatter');
const { formatNumber, createSeparator } = require('../utils/designSystem');

/**
 * Top command module
 * @module commands/top
 * @description Displays leaderboards for players and guilds
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('View leaderboards')
        .addSubcommand(subcommand =>
            subcommand
                .setName('players')
                .setDescription('View top players')
                .addStringOption(option =>
                    option
                        .setName('order_by')
                        .setDescription('Order by')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Alpha Balance', value: 'alpha_balance' },
                            { name: 'Alpha Value', value: 'alpha_value' }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('guilds')
                .setDescription('View top guilds')
                .addStringOption(option =>
                    option
                        .setName('order_by')
                        .setDescription('Order by')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Player Count', value: 'player_count' },
                            { name: 'Collateral Balance', value: 'collateral_balance' },
                            { name: 'Ratio', value: 'ratio' }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('substations')
                .setDescription('View top substations')
                .addStringOption(option =>
                    option
                        .setName('order_by')
                        .setDescription('Order by')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Load', value: 'load' },
                            { name: 'Capacity', value: 'capacity' },
                            { name: 'Player Count', value: 'player_count' },
                            { name: 'Ratio', value: 'ratio' }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reactors')
                .setDescription('View top reactors')
                .addStringOption(option =>
                    option
                        .setName('order_by')
                        .setDescription('Order by')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Fuel', value: 'fuel' },
                            { name: 'Power', value: 'power' }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('offers')
                .setDescription('View top offers')
                .addStringOption(option =>
                    option
                        .setName('order_by')
                        .setDescription('Order by')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Rate', value: 'rate_amount' },
                            { name: 'Player Count', value: 'player_count' },
                            { name: 'Provider Penalty', value: 'provider_cancellation_penalty' },
                            { name: 'Consumer Penalty', value: 'consumer_cancellation_pentalty' }
                        )
                )),

    /**
     * Execute handler for top command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand ('players' or 'guilds')
     * @param {Function} interaction.options.getString - Get string option value ('order_by')
     */
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();
            const orderBy = interaction.options.getString('order_by');

            let embed;
            switch (subcommand) {
                case 'players':
                    embed = await createPlayersLeaderboard(orderBy);
                    break;
                case 'guilds':
                    embed = await createGuildsLeaderboard(orderBy);
                    break;
                case 'substations':
                    embed = await createSubstationsLeaderboard(orderBy);
                    break;
                case 'reactors':
                    embed = await createReactorsLeaderboard(orderBy);
                    break;
                case 'offers':
                    embed = await createOffersLeaderboard(orderBy);
                    break;
                default:
                    return await interaction.editReply({ 
                        embeds: [createWarningEmbed(
                            'Invalid Subcommand',
                            'The selected subcommand is not valid. Please choose a valid option.'
                        )]
                    });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'top command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

async function createPlayersLeaderboard(orderBy) {
    let orderClause;
    switch (orderBy) {
        case 'alpha_balance':
            orderClause = 'ORDER BY alpha_balance DESC, alpha_value DESC';
            break;
        case 'alpha_value':
            orderClause = 'ORDER BY alpha_value DESC, alpha_balance DESC';
            break;
        default:
            orderClause = 'ORDER BY alpha_balance DESC, alpha_value DESC';
    }

    const result = await db.query(
        `SELECT 
            player_id,
            discord_username, 
            display_alpha_balance,
            display_alpha_value
        FROM view.leaderboard_player
        ${orderClause}
        LIMIT 10`,
        []
    );

    return createLeaderboardEmbed({
        title: 'Top Players',
        orderBy: orderBy === 'alpha_balance' ? 'alpha balance' : 'alpha value',
        items: result.rows,
        formatItem: (item, rank) => {
            const name = item.discord_username || `Player ID ${item.player_id}`;
            const isTopThree = rank <= 3;
            const prefix = isTopThree ? '**' : '';
            const suffix = isTopThree ? '**' : '';
            return `${prefix}${name}${suffix}\n   ⚡ Balance: ${item.display_alpha_balance} | 💎 Value: ${item.display_alpha_value}`;
        },
        topCount: 3
    });
}

async function createGuildsLeaderboard(orderBy) {
    let orderClause;
    switch (orderBy) {
        case 'player_count':
            orderClause = 'ORDER BY player_count DESC, collateral_balance DESC, ratio DESC';
            break;
        case 'collateral_balance':
            orderClause = 'ORDER BY collateral_balance DESC, player_count DESC, ratio DESC';
            break;
        case 'ratio':
            orderClause = 'ORDER BY ratio DESC, player_count DESC, collateral_balance DESC';
            break;
        default:
            orderClause = 'ORDER BY player_count DESC, collateral_balance DESC, ratio DESC';
    }

    const result = await db.query(
        `SELECT 
            id,
            name,
            tag, 
            player_count,
            display_collateral_balance,
            display_ratio
        FROM view.leaderboard_guild
        ${orderClause}
        LIMIT 10`,
        []
    );

    return createLeaderboardEmbed({
        title: 'Top Guilds',
        orderBy: orderBy.replace(/_/g, ' '),
        items: result.rows,
        formatItem: (item, rank) => {
            const isTopThree = rank <= 3;
            const prefix = isTopThree ? '**' : '';
            const suffix = isTopThree ? '**' : '';
            return `${prefix}${item.name}${suffix} [${item.tag}] #${item.id}\n   👥 Players: ${item.player_count} | 💰 Collateral: ${item.display_collateral_balance} | 📊 Ratio: ${item.display_ratio}`;
        },
        topCount: 3
    });
}

async function createSubstationsLeaderboard(orderBy) {
    let orderClause;
    switch (orderBy) {
        case 'load':
            orderClause = 'ORDER BY load DESC, capacity DESC, player_count DESC, ratio DESC';
            break;
        case 'capacity':
            orderClause = 'ORDER BY capacity DESC, load DESC, player_count DESC, ratio DESC';
            break;
        case 'player_count':
            orderClause = 'ORDER BY player_count DESC, load DESC, capacity DESC, ratio DESC';
            break;
        case 'ratio':
            orderClause = 'ORDER BY ratio DESC, load DESC, capacity DESC, player_count DESC';
            break;
        default:
            orderClause = 'ORDER BY load DESC, capacity DESC, player_count DESC, ratio DESC';
    }

    const result = await db.query(
        `SELECT 
            id,
            display_load,
            display_capacity,
            display_ratio,
            display_connection_capacity,
            player_count,
            owner,
            discord_username
        FROM view.leaderboard_substation
        ${orderClause}
        LIMIT 10`,
        []
    );

    return createLeaderboardEmbed({
        title: 'Top Substations',
        orderBy: orderBy.replace(/_/g, ' '),
        items: result.rows,
        formatItem: (item, rank) => {
            const isTopThree = rank <= 3;
            const prefix = isTopThree ? '**' : '';
            const suffix = isTopThree ? '**' : '';
            return `${prefix}${item.id}${suffix} (${item.discord_username || 'Unknown'})\n   ⚙️ Load: ${item.display_load} | 📊 Capacity: ${item.display_capacity}\n   📈 Ratio: ${item.display_ratio} | 👥 Players: ${item.player_count}`;
        },
        topCount: 3
    });
}

async function createReactorsLeaderboard(orderBy) {
    let orderClause;
    switch (orderBy) {
        case 'fuel':
            orderClause = 'ORDER BY fuel DESC, power DESC';
            break;
        case 'power':
            orderClause = 'ORDER BY power DESC, fuel DESC';
            break;
        default:
            orderClause = 'ORDER BY fuel DESC, power DESC';
    }

    const result = await db.query(
        `SELECT 
            id,
            display_fuel,
            display_power 
        FROM view.leaderboard_reactor
        ${orderClause}
        LIMIT 10`,
        []
    );

    return createLeaderboardEmbed({
        title: 'Top Reactors',
        orderBy: orderBy,
        items: result.rows,
        formatItem: (item, rank) => {
            const isTopThree = rank <= 3;
            const prefix = isTopThree ? '**' : '';
            const suffix = isTopThree ? '**' : '';
            return `${prefix}${item.id}${suffix}\n   ⛽ Fuel: ${item.display_fuel} | ⚡ Power: ${item.display_power}`;
        },
        topCount: 3
    });
}

async function createOffersLeaderboard(orderBy) {
    let orderClause;
    switch (orderBy) {
        case 'rate_amount':
            orderClause = 'ORDER BY rate_amount ASC, player_count DESC, provider_cancellation_penalty DESC, consumer_cancellation_pentalty ASC';
            break;
        case 'player_count':
            orderClause = 'ORDER BY player_count DESC, rate_amount ASC, provider_cancellation_penalty DESC, consumer_cancellation_pentalty ASC';
            break;
        case 'provider_cancellation_penalty':
            orderClause = 'ORDER BY provider_cancellation_penalty DESC, player_count DESC, rate_amount ASC, consumer_cancellation_pentalty ASC';
            break;
        case 'consumer_cancellation_pentalty':
            orderClause = 'ORDER BY consumer_cancellation_pentalty ASC, player_count DESC, rate_amount ASC, provider_cancellation_penalty DESC';
            break;
        default:
            orderClause = 'ORDER BY rate_amount ASC, player_count DESC, provider_cancellation_penalty DESC, consumer_cancellation_pentalty ASC';
    }

    const result = await db.query(
        `SELECT
            id,
            owner,
            discord_username,
            display_rate,
            access_policy,
            display_provider_cancellation_pentalty,
            display_consumer_cancellation_pentalty,
            player_count
        FROM view.leaderboard_provider 
        ${orderClause}
        LIMIT 10`,
        []
    );

    return createLeaderboardEmbed({
        title: 'Top Offers',
        orderBy: orderBy.replace(/_/g, ' '),
        items: result.rows,
        formatItem: (item, rank) => {
            const isTopThree = rank <= 3;
            const prefix = isTopThree ? '**' : '';
            const suffix = isTopThree ? '**' : '';
            return `${prefix}${item.id}${suffix} (${item.discord_username || 'Unknown'})\n   💰 Rate: ${item.display_rate} | 🔓 Access: ${item.access_policy}\n   ⚠️ Provider Penalty: ${item.display_provider_cancellation_pentalty} | Consumer Penalty: ${item.display_consumer_cancellation_pentalty}\n   👥 Players: ${item.player_count}`;
        },
        topCount: 3
    });
} 