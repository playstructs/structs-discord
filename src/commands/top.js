const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');

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
                    return await interaction.editReply('Invalid subcommand.');
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error executing top command:', error);
            await interaction.editReply('An error occurred while fetching the leaderboard.');
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

    const embed = new EmbedBuilder()
        .setTitle('🏆 Top Players')
        .setColor('#FFD700')
        .setDescription(`Players ranked by ${orderBy === 'alpha_balance' ? 'alpha balance' : 'alpha value'}`)
        .setTimestamp();

    let description = '';
    result.rows.forEach((row, index) => {
        description += `${index + 1}. **${row.discord_username || 'Player ID ' + row.player_id}**\n`;
        description += `   Balance: ${row.display_alpha_balance} | Value: ${row.display_alpha_value}\n\n`;
    });

    embed.setDescription(description || 'No players found.');
    return embed;
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

    const embed = new EmbedBuilder()
        .setTitle('🏰 Top Guilds')
        .setColor('#4169E1')
        .setDescription(`Guilds ranked by ${orderBy.replace('_', ' ')}`)
        .setTimestamp();

    let description = '';
    result.rows.forEach((row, index) => {
        description += `${index + 1}. **${row.name}** [${row.tag}] #${row.id}\n`;
        description += `   Players: ${row.player_count} | Collateral: ${row.display_collateral_balance} | Ratio: ${row.display_ratio}\n\n`;
    });

    embed.setDescription(description || 'No guilds found.');
    return embed;
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

    const embed = new EmbedBuilder()
        .setTitle('⚡ Top Substations')
        .setColor('#32CD32')
        .setDescription(`Substations ranked by ${orderBy.replace('_', ' ')}`)
        .setTimestamp();

    let description = '';
    result.rows.forEach((row, index) => {
        description += `${index + 1}. **${row.id}** (${row.discord_username || 'Unknown'})\n`;
        description += `   Load: ${row.display_load} | Capacity: ${row.display_capacity}\n`;
        description += `   Ratio: ${row.display_ratio} | Players: ${row.player_count}\n\n`;
    });

    embed.setDescription(description || 'No substations found.');
    return embed;
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

    const embed = new EmbedBuilder()
        .setTitle('🔋 Top Reactors')
        .setColor('#FF4500')
        .setDescription(`Reactors ranked by ${orderBy}`)
        .setTimestamp();

    let description = '';
    result.rows.forEach((row, index) => {
        description += `${index + 1}. **${row.id}**\n`;
        description += `   Fuel: ${row.display_fuel} | Power: ${row.display_power}\n\n`;
    });

    embed.setDescription(description || 'No reactors found.');
    return embed;
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

    const embed = new EmbedBuilder()
        .setTitle('💰 Top Offers')
        .setColor('#9370DB')
        .setDescription(`Offers ranked by ${orderBy.replace(/_/g, ' ')}`)
        .setTimestamp();

    let description = '';
    result.rows.forEach((row, index) => {
        description += `${index + 1}. **${row.id}** (${row.discord_username || 'Unknown'})\n`;
        description += `   Rate: ${row.display_rate} | Access: ${row.access_policy}\n`;
        description += `   Provider Penalty: ${row.display_provider_cancellation_pentalty} | Consumer Penalty: ${row.display_consumer_cancellation_pentalty}\n`;
        description += `   Players: ${row.player_count}\n\n`;
    });

    embed.setDescription(description || 'No offers found.');
    return embed;
} 