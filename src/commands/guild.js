const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guild')
        .setDescription('Guild operations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('authorization-status')
                .setDescription('Check guild authorization status')
                .addStringOption(option =>
                    option.setName('guild_id')
                        .setDescription('Guild ID to check')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'authorization-status':
                    await handleAuthorizationStatus(interaction);
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

async function handleAuthorizationStatus(interaction) {
    const guildId = interaction.options.getString('guild_id');
    
    try {
        // TODO: Implement authorization status check logic
        // This should query the database for:
        // 1. Proxy join address, pubkey, and signature
        // 2. Current permissions status (16 on guild, 48 on substation)
        
        const embed = {
            title: `Authorization Status for Guild ${guildId}`,
            fields: [
                {
                    name: 'Proxy Join Details',
                    value: '```\nAddress: 0x...\nPubkey: 0x...\nSignature: 0x...\n```',
                    inline: false
                },
                {
                    name: 'Permissions Status',
                    value: '```\nGuild Permissions (16): Pending\nSubstation Permissions (48): Pending\n```',
                    inline: false
                }
            ],
            color: 0x0099FF
        };

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error checking authorization status:', error);
        await interaction.reply({ 
            content: 'Failed to check authorization status. Please try again later.', 
            ephemeral: true 
        });
    }
} 