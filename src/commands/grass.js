const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const natsService = require('../services/nats');
const { EMOJIS } = require('../constants/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grass')
        .setDescription('Manage GRASS notifications for this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName('subscribe')
                .setDescription('Subscribe to GRASS notifications')
                .addStringOption(option =>
                    option
                        .setName('subscription')
                        .setDescription('The subscription pattern (e.g., structs.subject.>)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unsubscribe')
                .setDescription('Unsubscribe from GRASS notifications')
                .addStringOption(option =>
                    option
                        .setName('subscription')
                        .setDescription('The subscription pattern to unsubscribe from')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all active subscriptions for this channel')
        ),

    async execute(interaction) {
        const channelId = interaction.channelId;
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'subscribe': {
                    const subscription = interaction.options.getString('subscription');
                    const success = await natsService.addSubscription(channelId, subscription);
                    
                    if (success) {
                        await interaction.reply({
                            content: `${EMOJIS.SUCCESS} Successfully subscribed to ${subscription}`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: `${EMOJIS.ERROR} Failed to subscribe to ${subscription}`,
                            ephemeral: true
                        });
                    }
                    break;
                }
                case 'unsubscribe': {
                    const subscription = interaction.options.getString('subscription');
                    const success = await natsService.removeSubscription(channelId, subscription);
                    
                    if (success) {
                        await interaction.reply({
                            content: `${EMOJIS.SUCCESS} Successfully unsubscribed from ${subscription}`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: `${EMOJIS.ERROR} Failed to unsubscribe from ${subscription}`,
                            ephemeral: true
                        });
                    }
                    break;
                }
                case 'list': {
                    const subscriptions = await natsService.getChannelSubscriptions(channelId);
                    
                    if (subscriptions.length === 0) {
                        await interaction.reply({
                            content: `${EMOJIS.INFO} No active subscriptions for this channel`,
                            ephemeral: true
                        });
                    } else {
                        const subscriptionList = subscriptions.map(sub => `• ${sub}`).join('\n');
                        await interaction.reply({
                            content: `${EMOJIS.INFO} **Active Subscriptions**:\n${subscriptionList}`,
                            ephemeral: true
                        });
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Error in GRASS command:', error);
            await interaction.reply({
                content: `${EMOJIS.ERROR} An error occurred while processing your request`,
                ephemeral: true
            });
        }
    }
}; 