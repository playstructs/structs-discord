const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { handleError, createSuccessEmbed, createInfoEmbed } = require('../utils/errors');
const { formatUnit } = require('../utils/format');

/**
 * Calculate command module
 * @module commands/calculate
 * @description Provides calculation utilities for economic values, refining, and energy production
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('calculate')
        .setDescription('Calculate economic values and costs')
        .addSubcommand(subcommand =>
            subcommand
                .setName('refine')
                .setDescription('Calculate Alpha Matter from refining ore')
                .addNumberOption(option =>
                    option
                        .setName('ore_amount')
                        .setDescription('Amount of ore to refine (in grams)')
                        .setRequired(true)
                        .setMinValue(0.000001)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('energy')
                .setDescription('Calculate energy production from Alpha Matter')
                .addNumberOption(option =>
                    option
                        .setName('alpha_amount')
                        .setDescription('Amount of Alpha Matter (in grams)')
                        .setRequired(true)
                        .setMinValue(0.000001)
                )
                .addStringOption(option =>
                    option
                        .setName('generator_type')
                        .setDescription('Type of generator')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Reactor (1 kW/g)', value: 'reactor' },
                            { name: 'Field Generator (2 kW/g)', value: 'fieldGenerator' },
                            { name: 'Continental Power Plant (5 kW/g)', value: 'continentalPowerPlant' },
                            { name: 'World Engine (10 kW/g)', value: 'worldEngine' }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('agreement')
                .setDescription('Calculate total cost of a market agreement')
                .addNumberOption(option =>
                    option
                        .setName('rate')
                        .setDescription('Rate per block')
                        .setRequired(true)
                        .setMinValue(0.000001)
                )
                .addNumberOption(option =>
                    option
                        .setName('capacity')
                        .setDescription('Capacity per block')
                        .setRequired(true)
                        .setMinValue(0.000001)
                )
                .addIntegerOption(option =>
                    option
                        .setName('duration')
                        .setDescription('Duration in blocks')
                        .setRequired(true)
                        .setMinValue(1)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('token-value')
                .setDescription('Calculate Alpha Matter value of guild tokens')
                .addNumberOption(option =>
                    option
                        .setName('token_amount')
                        .setDescription('Amount of guild tokens')
                        .setRequired(true)
                        .setMinValue(0.000001)
                )
                .addNumberOption(option =>
                    option
                        .setName('ratio')
                        .setDescription('Guild bank ratio (0.0 to 1.0)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(1)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('capacity')
                .setDescription('Calculate energy capacity and load')
                .addNumberOption(option =>
                    option
                        .setName('base_capacity')
                        .setDescription('Base energy capacity (in milliwatts)')
                        .setRequired(true)
                        .setMinValue(0)
                )
                .addNumberOption(option =>
                    option
                        .setName('connection_capacity')
                        .setDescription('Connection capacity from substation (in milliwatts)')
                        .setRequired(false)
                        .setMinValue(0)
                )
                .addNumberOption(option =>
                    option
                        .setName('load')
                        .setDescription('Current energy load (in milliwatts)')
                        .setRequired(false)
                        .setMinValue(0)
                )
                .addNumberOption(option =>
                    option
                        .setName('structs_load')
                        .setDescription('Energy load from structures (in milliwatts)')
                        .setRequired(false)
                        .setMinValue(0)
                )),

    /**
     * Execute handler for calculate command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand
     * @param {Function} interaction.options.getNumber - Get number option values
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        try {
            let embed;

            switch (subcommand) {
                case 'refine':
                    embed = await calculateRefine(interaction);
                    break;
                case 'energy':
                    embed = await calculateEnergy(interaction);
                    break;
                case 'agreement':
                    embed = await calculateAgreement(interaction);
                    break;
                case 'token-value':
                    embed = await calculateTokenValue(interaction);
                    break;
                case 'capacity':
                    embed = await calculateCapacity(interaction);
                    break;
                default:
                    return await interaction.editReply({
                        embeds: [createInfoEmbed(
                            'Invalid Calculation',
                            'Please select a valid calculation type.'
                        )]
                    });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'calculate command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

async function calculateRefine(interaction) {
    const oreAmount = interaction.options.getNumber('ore_amount');
    
    // Formula: alpha_produced = ore_input × 1,000,000
    // Convert grams to ualpha (micro-alpha)
    const alphaProduced = oreAmount * 1000000;
    
    const formattedOre = await formatUnit(oreAmount, 'ore');
    const formattedAlpha = await formatUnit(alphaProduced, 'ualpha');
    
    return new EmbedBuilder()
        .setTitle('💰 Ore Refining Calculation')
        .setColor('#00ff00')
        .setDescription('Calculate Alpha Matter produced from refining ore')
        .addFields(
            { name: 'Ore Input', value: formattedOre, inline: true },
            { name: 'Alpha Produced', value: formattedAlpha, inline: true },
            { name: 'Formula', value: '`alpha_produced = ore_input × 1,000,000`', inline: false },
            { name: 'Rate', value: '1 gram ore = 1,000,000 ualpha', inline: false }
        )
        .setFooter({ text: 'This rate is constant and does not change based on market conditions.' })
        .setTimestamp();
}

async function calculateEnergy(interaction) {
    const alphaAmount = interaction.options.getNumber('alpha_amount');
    const generatorType = interaction.options.getString('generator_type');
    
    // Generator conversion rates (kW per gram of Alpha Matter)
    const rates = {
        'reactor': 1,
        'fieldGenerator': 2,
        'continentalPowerPlant': 5,
        'worldEngine': 10
    };
    
    const rate = rates[generatorType];
    const generatorNames = {
        'reactor': 'Reactor',
        'fieldGenerator': 'Field Generator',
        'continentalPowerPlant': 'Continental Power Plant',
        'worldEngine': 'World Engine'
    };
    
    // Formula: power_output = alpha_matter × conversion_rate
    // Convert to milliwatts (1 kW = 1,000,000 mW)
    const powerOutput = alphaAmount * rate * 1000000;
    
    const formattedAlpha = await formatUnit(alphaAmount, 'ualpha');
    const formattedPower = await formatUnit(powerOutput, 'milliwatt');
    
    return new EmbedBuilder()
        .setTitle('⚡ Energy Production Calculation')
        .setColor('#00ff00')
        .setDescription(`Calculate energy production for ${generatorNames[generatorType]}`)
        .addFields(
            { name: 'Alpha Matter Input', value: formattedAlpha, inline: true },
            { name: 'Generator Type', value: generatorNames[generatorType], inline: true },
            { name: 'Conversion Rate', value: `${rate} kW/g`, inline: true },
            { name: 'Power Output', value: formattedPower, inline: true },
            { name: 'Formula', value: '`power_output = alpha_matter × conversion_rate`', inline: false }
        )
        .setFooter({ text: '⚠️ Energy production rates need verification against game code.' })
        .setTimestamp();
}

async function calculateAgreement(interaction) {
    const rate = interaction.options.getNumber('rate');
    const capacity = interaction.options.getNumber('capacity');
    const duration = interaction.options.getInteger('duration');
    
    // Formula: total_cost = rate × capacity × duration
    const totalCost = rate * capacity * duration;
    
    return new EmbedBuilder()
        .setTitle('📊 Market Agreement Cost Calculation')
        .setColor('#00ff00')
        .setDescription('Calculate the total cost of a market agreement')
        .addFields(
            { name: 'Rate (per block)', value: rate.toLocaleString(), inline: true },
            { name: 'Capacity (per block)', value: capacity.toLocaleString(), inline: true },
            { name: 'Duration (blocks)', value: duration.toLocaleString(), inline: true },
            { name: 'Total Cost', value: totalCost.toLocaleString(), inline: true },
            { name: 'Formula', value: '`total_cost = rate × capacity × duration`', inline: false }
        )
        .setFooter({ text: 'This is the total cost you will pay for the entire agreement duration.' })
        .setTimestamp();
}

async function calculateTokenValue(interaction) {
    const tokenAmount = interaction.options.getNumber('token_amount');
    const ratio = interaction.options.getNumber('ratio');
    
    // Formula: alpha_value = guild_bank.ratio × token_amount
    const alphaValue = ratio * tokenAmount;
    
    const formattedTokens = tokenAmount.toLocaleString();
    const formattedAlpha = await formatUnit(alphaValue, 'ualpha');
    
    return new EmbedBuilder()
        .setTitle('🪙 Guild Token Value Calculation')
        .setColor('#00ff00')
        .setDescription('Calculate Alpha Matter value of guild tokens')
        .addFields(
            { name: 'Token Amount', value: formattedTokens, inline: true },
            { name: 'Guild Ratio', value: ratio.toFixed(4), inline: true },
            { name: 'Alpha Value', value: formattedAlpha, inline: true },
            { name: 'Formula', value: '`alpha_value = guild_bank.ratio × token_amount`', inline: false }
        )
        .setFooter({ text: 'Use /inventory to see your actual guild token ratio.' })
        .setTimestamp();
}

async function calculateCapacity(interaction) {
    const baseCapacity = interaction.options.getNumber('base_capacity');
    const connectionCapacity = interaction.options.getNumber('connection_capacity') || 0;
    const load = interaction.options.getNumber('load') || 0;
    const structsLoad = interaction.options.getNumber('structs_load') || 0;
    
    // Formulas:
    // total_capacity = capacity + connectionCapacity
    // total_load = load + structsLoad
    // available_capacity = total_capacity - total_load
    const totalCapacity = baseCapacity + connectionCapacity;
    const totalLoad = load + structsLoad;
    const availableCapacity = totalCapacity - totalLoad;
    
    const formattedTotalCapacity = await formatUnit(totalCapacity, 'milliwatt');
    const formattedTotalLoad = await formatUnit(totalLoad, 'milliwatt');
    const formattedAvailable = await formatUnit(availableCapacity, 'milliwatt');
    
    const utilizationPercent = totalCapacity > 0 
        ? ((totalLoad / totalCapacity) * 100).toFixed(1) 
        : '0.0';
    
    return new EmbedBuilder()
        .setTitle('🔋 Energy Capacity Calculation')
        .setColor('#00ff00')
        .setDescription('Calculate energy capacity and load')
        .addFields(
            { name: 'Base Capacity', value: await formatUnit(baseCapacity, 'milliwatt'), inline: true },
            { name: 'Connection Capacity', value: await formatUnit(connectionCapacity, 'milliwatt'), inline: true },
            { name: 'Total Capacity', value: formattedTotalCapacity, inline: true },
            { name: 'Load', value: await formatUnit(load, 'milliwatt'), inline: true },
            { name: 'Structures Load', value: await formatUnit(structsLoad, 'milliwatt'), inline: true },
            { name: 'Total Load', value: formattedTotalLoad, inline: true },
            { name: 'Available Capacity', value: formattedAvailable, inline: true },
            { name: 'Utilization', value: `${utilizationPercent}%`, inline: true },
            { name: 'Formulas', value: '`total_capacity = capacity + connectionCapacity`\n`total_load = load + structsLoad`\n`available = total_capacity - total_load`', inline: false }
        )
        .setFooter({ text: 'Use /station to see your actual energy capacity and load.' })
        .setTimestamp();
}

