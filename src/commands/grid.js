const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grid')
        .setDescription('Grid operations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('wire')
                .setDescription('Transfer resources')
                .addStringOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to transfer')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('destination')
                        .setDescription('Destination (player ID, @discord mention, or address)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('provide')
                .setDescription('Provide resources')
                .addStringOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to provide')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('agree')
                .setDescription('Agree to a provider')
                .addStringOption(option =>
                    option.setName('provider_id')
                        .setDescription('Provider ID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('capacity')
                        .setDescription('Capacity')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Duration')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('connect')
                .setDescription('Connect to grid')
                .addStringOption(option =>
                    option.setName('allocation')
                        .setDescription('Select an allocation')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('substation')
                        .setDescription('Select a substation')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('allocate')
                .setDescription('Allocate resources')
                .addStringOption(option =>
                    option.setName('source')
                        .setDescription('Select source object')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to allocate')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('destination')
                        .setDescription('Destination (address, player ID, or @discord)')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'wire':
                    await handleWire(interaction);
                    break;
                case 'provide':
                    await handleProvide(interaction);
                    break;
                case 'agree':
                    await handleAgree(interaction);
                    break;
                case 'connect':
                    await handleConnect(interaction);
                    break;
                case 'allocate':
                    await handleAllocate(interaction);
                    break;
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: 'There was an error executing this command!', 
                ephemeral: true 
            });
        }
    }
};

async function handleWire(interaction) {
    const amount = interaction.options.getString('amount');
    const destination = interaction.options.getString('destination');
    // TODO: Implement wire transfer logic
    await interaction.reply(`Transferring ${amount} to ${destination}`);
}

async function handleProvide(interaction) {
    const amount = interaction.options.getString('amount');
    // TODO: Implement provide logic
    await interaction.reply(`Providing ${amount} resources`);
}

async function handleAgree(interaction) {
    const providerId = interaction.options.getString('provider_id');
    const capacity = interaction.options.getString('capacity');
    const duration = interaction.options.getString('duration');
    // TODO: Implement agree logic
    await interaction.reply(`Agreeing to provider ${providerId} with capacity ${capacity} for duration ${duration}`);
}

async function handleConnect(interaction) {
    const allocation = interaction.options.getString('allocation');
    const substation = interaction.options.getString('substation');
    // TODO: Implement connect logic
    await interaction.reply(`Connecting allocation ${allocation} to substation ${substation}`);
}

async function handleAllocate(interaction) {
    const source = interaction.options.getString('source');
    const amount = interaction.options.getString('amount');
    const destination = interaction.options.getString('destination');
    // TODO: Implement allocate logic
    await interaction.reply(`Allocating ${amount} from ${source} to ${destination}`);
} 