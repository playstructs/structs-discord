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
        await interaction.deferReply({ ephemeral: true });

        const channelId = interaction.channelId;
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'subscribe': {
                    const subscription = interaction.options.getString('subscription');
                    try {
                        await natsService.addSubscription(channelId, subscription);
                        await interaction.editReply({
                            content: `${EMOJIS.STATUS.SUCCESS} Successfully subscribed to ${subscription}`,
                            ephemeral: true
                        });
                    } catch (error) {
                        console.error('Error subscribing:', error);
                        await interaction.editReply({
                            content: `${EMOJIS.STATUS.ERROR} ${error.message}`,
                            ephemeral: true
                        });
                    }
                    break;
                }
                case 'unsubscribe': {
                    const subscription = interaction.options.getString('subscription');
                    try {
                        await natsService.removeSubscription(channelId, subscription);
                        await interaction.editReply({
                            content: `${EMOJIS.STATUS.SUCCESS} Successfully unsubscribed from ${subscription}`,
                            ephemeral: true
                        });
                    } catch (error) {
                        console.error('Error unsubscribing:', error);
                        await interaction.editReply({
                            content: `${EMOJIS.STATUS.ERROR} ${error.message}`,
                            ephemeral: true
                        });
                    }
                    break;
                }
                case 'list': {
                    try {
                    const subscriptions = await natsService.getChannelSubscriptions(channelId);
                    
                    if (subscriptions.length === 0) {
                        await interaction.editReply({
                                content: `${EMOJIS.STATUS.INFO} No active subscriptions for this channel`,
                            ephemeral: true
                        });
                    } else {
                        const subscriptionList = subscriptions.map(sub => `• ${sub}`).join('\n');
                        await interaction.editReply({
                                content: `${EMOJIS.STATUS.INFO} **Active Subscriptions**:\n${subscriptionList}`,
                                ephemeral: true
                            });
                        }
                    } catch (error) {
                        console.error('Error listing subscriptions:', error);
                        await interaction.editReply({
                            content: `${EMOJIS.STATUS.ERROR} ${error.message}`,
                            ephemeral: true
                        });
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Error executing grass command:', error);
            await interaction.editReply(`${EMOJIS.STATUS.ERROR} An error occurred while processing your grass request.`);
        }
    }
}; 