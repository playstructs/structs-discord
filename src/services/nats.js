const { connect } = require('nats');
const { query } = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { EmbedBuilder } = require('discord.js');
require('dotenv').config();

class NATSService {
    constructor() {
        this.nc = null;
        this.subscriptions = new Map(); // channelId -> Set of subscriptions
        this.isConnected = false;
        this.discordClient = null; // Will be set when Discord client is ready
    }

    setDiscordClient(client) {
        this.discordClient = client;
    }

    async initialize() {
        try {
            const natsUrl = process.env.NATS_URL || 'nats://structs-nats:4222';
            console.log(`Attempting to connect to NATS server at ${natsUrl}`);
            
            this.nc = await connect({
                servers: natsUrl,
                timeout: 5000, // 5 second timeout
                reconnect: true,
                maxReconnectAttempts: 5
            });
            
            console.log('Connected to NATS server');
            this.isConnected = true;

            // Add connection status monitoring
            this.nc.closed()
                .then(() => {
                    console.log('NATS connection closed');
                    this.isConnected = false;
                })
                .catch(err => {
                    console.error('NATS connection error:', err);
                    this.isConnected = false;
                });

            // Add a test subscription to verify connectivity
            const testSub = this.nc.subscribe('test.>', {
                callback: (err, msg) => {
                    if (err) {
                        console.error('Test subscription error:', err);
                        return;
                    }
                    console.log('Test message received:', msg.data.toString());
                }
            });
            console.log('Test subscription created');

            // Load existing subscriptions from database
            await this.loadSubscriptions();
        } catch (error) {
            console.error('Failed to connect to NATS:', error);
            this.isConnected = false;
            throw new Error('Failed to connect to NATS server. Please check if the NATS server is running and accessible.');
        }
    }

    async loadSubscriptions() {
        try {
            console.log('Loading subscriptions from database');
            const result = await query(
                'SELECT channel_id, subscription FROM structs.discord_channel'
            );

            console.log(`Found ${result.rows.length} subscriptions in database`);
            for (const row of result.rows) {
                console.log(`Loading subscription for channel ${row.channel_id}: ${row.subscription}`);
                await this.subscribe(row.channel_id, row.subscription);
            }
        } catch (error) {
            console.error('Failed to load subscriptions:', error);
        }
    }

    async subscribe(channelId, subscription) {
        try {
            console.log(`Subscribing channel ${channelId} to ${subscription}`);
            
            // Initialize Set if it doesn't exist
            if (!this.subscriptions.has(channelId)) {
                this.subscriptions.set(channelId, new Set());
            }

            // Create the subscription with a callback
            const sub = this.nc.subscribe(subscription, {
                callback: async (err, msg) => {
                    if (err) {
                        console.error(`Error in subscription callback for ${subscription}:`, err);
                        return;
                    }
                    console.log(`Received message for channel ${channelId} on ${subscription}`);
                    console.log('Message subject:', msg.subject);
                    console.log('Message data:', msg.data.toString());
                    await this.handleMessage(channelId, msg);
                }
            });
            
            // Add subscription to channel's Set
            this.subscriptions.get(channelId).add(sub);
            console.log(`Successfully subscribed channel ${channelId} to ${subscription}`);

            return true;
        } catch (error) {
            console.error(`Failed to subscribe ${channelId} to ${subscription}:`, error);
            return false;
        }
    }

    async unsubscribe(channelId, subscription) {
        try {
            const channelSubs = this.subscriptions.get(channelId);
            if (!channelSubs) return true;

            // Find and unsubscribe the specific subscription
            for (const sub of channelSubs) {
                if (sub.subject === subscription) {
                    sub.unsubscribe();
                    channelSubs.delete(sub);
                }
            }

            // If no more subscriptions, remove the channel entry
            if (channelSubs.size === 0) {
                this.subscriptions.delete(channelId);
            }

            return true;
        } catch (error) {
            console.error(`Failed to unsubscribe ${channelId} from ${subscription}:`, error);
            return false;
        }
    }

    async handleMessage(channelId, msg) {
        try {
            console.log(`Handling message for channel ${channelId}`);
            console.log('Message subject:', msg.subject);
            console.log('Raw message data:', msg.data.toString());
            
            if (!this.discordClient) {
                console.error('Discord client not initialized');
                return;
            }

            const channel = await this.discordClient.channels.fetch(channelId);
            if (!channel) {
                console.error(`Discord channel ${channelId} not found`);
                return;
            }

            let data;
            try {
                data = JSON.parse(msg.data);
                console.log('Parsed message data:', JSON.stringify(data, null, 2));
            } catch (parseError) {
                console.error('Failed to parse message data:', parseError);
                return;
            }

            if (!data) {
                console.error('Message data is null or undefined');
                return;
            }

            // Format message based on category
            if (data.category === 'agreement') {
                console.log('Creating agreement embed');
                const embed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.INFO} Agreement Update`)
                    .setColor('#0099ff')
                    .addFields(
                        { name: 'Allocation ID', value: data.allocation_id || 'N/A', inline: true },
                        { name: 'Capacity', value: data.capacity?.toString() || 'N/A', inline: true },
                        { name: 'Start Block', value: data.start_block?.toString() || 'N/A', inline: true },
                        { name: 'End Block', value: data.end_block?.toString() || 'N/A', inline: true },
                        { name: 'Creator', value: data.creator || 'N/A', inline: true },
                        { name: 'Owner', value: data.owner || 'N/A', inline: true }
                    )
                    .setTimestamp(data.updated_at ? new Date(data.updated_at) : new Date());

                console.log('Sending agreement embed to Discord');
                await channel.send({ embeds: [embed] });
                console.log('Agreement embed sent successfully');
            } else if (data.subject?.startsWith('structs.grid.')) {
                const embed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.INFO} Grid Update`)
                    .setColor('#0099ff')
                    .addFields(
                        { name: 'Object Type', value: data.object_type || 'N/A', inline: true },
                        { name: 'Object ID', value: data.object_id || 'N/A', inline: true },
                        { name: 'Attribute Type', value: data.attribute_type || 'N/A', inline: true },
                        { name: 'Value', value: data.value?.toString() || 'N/A', inline: true }
                    )
                    .setTimestamp(data.updated_at ? new Date(data.updated_at) : new Date());

                await channel.send({ embeds: [embed] });
            } else if (data.subject?.startsWith('structs.guild.')) {
                let embed;
                switch (data.category) {
                    case 'guild_consensus':
                        embed = new EmbedBuilder()
                            .setTitle(`${EMOJIS.INFO} Guild Consensus Update`)
                            .setColor('#0099ff')
                            .addFields(
                                { name: 'Guild ID', value: data.id || 'N/A', inline: true },
                                { name: 'Index', value: data.index?.toString() || 'N/A', inline: true },
                                { name: 'Endpoint', value: data.endpoint || 'N/A', inline: true },
                                { name: 'Join Infusion Min', value: data.join_infusion_minimum?.toString() || 'N/A', inline: true },
                                { name: 'Primary Reactor', value: data.primary_reactor_id || 'N/A', inline: true },
                                { name: 'Entry Substation', value: data.entry_substation_id || 'N/A', inline: true }
                            );
                        break;
                    case 'guild_meta':
                        embed = new EmbedBuilder()
                            .setTitle(`${EMOJIS.INFO} Guild Meta Update`)
                            .setColor('#0099ff')
                            .addFields(
                                { name: 'Guild ID', value: data.id || 'N/A', inline: true },
                                { name: 'Name', value: data.name || 'N/A', inline: true },
                                { name: 'Tag', value: data.tag || 'N/A', inline: true },
                                { name: 'Status', value: data.status || 'N/A', inline: true },
                                { name: 'Domain', value: data.domain || 'N/A', inline: true },
                                { name: 'Website', value: data.website || 'N/A', inline: true }
                            );
                        break;
                    case 'guild_membership':
                        embed = new EmbedBuilder()
                            .setTitle(`${EMOJIS.INFO} Guild Membership Update`)
                            .setColor('#0099ff')
                            .addFields(
                                { name: 'Guild ID', value: data.guild_id || 'N/A', inline: true },
                                { name: 'Player ID', value: data.player_id || 'N/A', inline: true },
                                { name: 'Join Type', value: data.join_type || 'N/A', inline: true },
                                { name: 'Status', value: data.status || 'N/A', inline: true },
                                { name: 'Proposer', value: data.proposer || 'N/A', inline: true },
                                { name: 'Substation', value: data.substation_id || 'N/A', inline: true }
                            );
                        break;
                }

                if (embed) {
                    embed.setTimestamp(data.updated_at ? new Date(data.updated_at) : new Date());
                    await channel.send({ embeds: [embed] });
                }
            } else if (data.subject?.startsWith('structs.inventory.')) {
                const embed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.INFO} Inventory Update`)
                    .setColor('#0099ff')
                    .addFields(
                        { name: 'Action', value: data.action || 'N/A', inline: true },
                        { name: 'Direction', value: data.direction || 'N/A', inline: true },
                        { name: 'Amount', value: data.amount?.toString() || 'N/A', inline: true },
                        { name: 'Denom', value: data.denom || 'N/A', inline: true },
                        { name: 'Address', value: data.address || 'N/A', inline: true },
                        { name: 'Counterparty', value: data.counterparty || 'N/A', inline: true },
                        { name: 'Guild ID', value: data.guild_id || 'N/A', inline: true },
                        { name: 'Player ID', value: data.player_id || 'N/A', inline: true },
                        { name: 'Object ID', value: data.object_id || 'N/A', inline: true },
                        { name: 'Block Height', value: data.block_height?.toString() || 'N/A', inline: true }
                    )
                    .setTimestamp(data.time || new Date());

                await channel.send({ embeds: [embed] });
            } else if (data.subject?.startsWith('structs.planet.')) {
                const embed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.INFO} Planet Activity Update`)
                    .setColor('#0099ff')
                    .addFields(
                        { name: 'Planet ID', value: data.planet_id || 'N/A', inline: true },
                        { name: 'Sequence', value: data.seq?.toString() || 'N/A', inline: true },
                        { name: 'Category', value: data.category || 'N/A', inline: true }
                    );

                // Add detail fields if available and not a stub
                if (data.detail && !data.stub) {
                    const detailFields = Object.entries(data.detail).map(([key, value]) => ({
                        name: key,
                        value: typeof value === 'object' ? JSON.stringify(value) : value.toString(),
                        inline: true
                    }));
                    embed.addFields(detailFields);
                }

                embed.setTimestamp(data.time || new Date());
                await channel.send({ embeds: [embed] });
            } else if (data.subject?.startsWith('structs.player.')) {
                let embed;
                switch (data.category) {
                    case 'player_consensus':
                        embed = new EmbedBuilder()
                            .setTitle(`${EMOJIS.INFO} Player Consensus Update`)
                            .setColor('#0099ff')
                            .addFields(
                                { name: 'Player ID', value: data.id || 'N/A', inline: true },
                                { name: 'Index', value: data.index?.toString() || 'N/A', inline: true },
                                { name: 'Creator', value: data.creator || 'N/A', inline: true },
                                { name: 'Primary Address', value: data.primary_address || 'N/A', inline: true },
                                { name: 'Guild ID', value: data.guild_id || 'N/A', inline: true },
                                { name: 'Substation ID', value: data.substation_id || 'N/A', inline: true },
                                { name: 'Planet ID', value: data.planet_id || 'N/A', inline: true },
                                { name: 'Fleet ID', value: data.fleet_id || 'N/A', inline: true }
                            );
                        break;
                    case 'player_meta':
                        embed = new EmbedBuilder()
                            .setTitle(`${EMOJIS.INFO} Player Meta Update`)
                            .setColor('#0099ff')
                            .addFields(
                                { name: 'Player ID', value: data.id || 'N/A', inline: true },
                                { name: 'Guild ID', value: data.guild_id || 'N/A', inline: true },
                                { name: 'Username', value: data.username || 'N/A', inline: true },
                                { name: 'Status', value: data.status || 'N/A', inline: true }
                            );
                        break;
                }

                if (embed) {
                    embed.setTimestamp(data.updated_at || new Date());
                    await channel.send({ embeds: [embed] });
                }
            } else if (data.subject?.startsWith('structs.provider.')) {
                const embed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.INFO} Provider Update`)
                    .setColor('#0099ff')
                    .addFields(
                        { name: 'Provider ID', value: data.id || 'N/A', inline: true },
                        { name: 'Index', value: data.index?.toString() || 'N/A', inline: true },
                        { name: 'Substation ID', value: data.substation_id || 'N/A', inline: true },
                        { name: 'Rate', value: `${data.rate_amount?.toString() || 'N/A'} ${data.rate_denom || ''}`, inline: true },
                        { name: 'Access Policy', value: data.access_policy || 'N/A', inline: true },
                        { name: 'Capacity Min', value: data.capacity_minimum?.toString() || 'N/A', inline: true },
                        { name: 'Capacity Max', value: data.capacity_maximum?.toString() || 'N/A', inline: true },
                        { name: 'Duration Min', value: data.duration_minimum?.toString() || 'N/A', inline: true },
                        { name: 'Duration Max', value: data.duration_maximum?.toString() || 'N/A', inline: true },
                        { name: 'Provider Cancel Penalty', value: data.provider_cancellation_penalty?.toString() || 'N/A', inline: true },
                        { name: 'Consumer Cancel Penalty', value: data.consumer_cancellation_penalty?.toString() || 'N/A', inline: true },
                        { name: 'Creator', value: data.creator || 'N/A', inline: true },
                        { name: 'Owner', value: data.owner || 'N/A', inline: true }
                    )
                    .setTimestamp(data.updated_at || new Date());

                await channel.send({ embeds: [embed] });
            } else if (data.subject === 'structs.consensus' && data.category === 'block') {
                const embed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.INFO} Block Update`)
                    .setColor('#0099ff')
                    .addFields(
                        { name: 'Height', value: data.height?.toString() || 'N/A', inline: true }
                    )
                    .setTimestamp(data.updated_at || new Date());

                await channel.send({ embeds: [embed] });
            } else {
                let message = '';
                switch (data.category) {
                    case 'alert':
                        message = `${EMOJIS.ALERT} **ALERT**: ${data.message}`;
                        break;
                    case 'warning':
                        message = `${EMOJIS.WARNING} **WARNING**: ${data.message}`;
                        break;
                    case 'info':
                        message = `${EMOJIS.INFO} **INFO**: ${data.message}`;
                        break;
                    default:
                        message = `${EMOJIS.INFO} ${data.message}`;
                }

                await channel.send(message);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    async addSubscription(channelId, subscription) {
        try {
            if (!this.isConnected) {
                throw new Error('NATS service is not connected. Please try again later.');
            }

            // Add to database
            await query(
                'INSERT INTO structs.discord_channel (channel_id, subscription) VALUES ($1, $2)',
                [channelId, subscription]
            );

            // Subscribe to NATS
            return await this.subscribe(channelId, subscription);
        } catch (error) {
            console.error('Error adding subscription:', error);
            throw error;
        }
    }

    async removeSubscription(channelId, subscription) {
        try {
            // Remove from database
            await query(
                'DELETE FROM structs.discord_channel WHERE channel_id = $1 AND subscription = $2',
                [channelId, subscription]
            );

            // Unsubscribe from NATS
            return await this.unsubscribe(channelId, subscription);
        } catch (error) {
            console.error('Error removing subscription:', error);
            return false;
        }
    }

    async getChannelSubscriptions(channelId) {
        try {
            const result = await query(
                'SELECT subscription FROM structs.discord_channel WHERE channel_id = $1',
                [channelId]
            );
            return result.rows.map(row => row.subscription);
        } catch (error) {
            console.error('Error getting channel subscriptions:', error);
            return [];
        }
    }

    async testConnection() {
        try {
            // Send a test message with proper format
            const testMessage = {
                category: 'agreement',
                allocation_id: 'test-123',
                capacity: 1000,
                start_block: 1,
                end_block: 1000,
                creator: 'test-creator',
                owner: 'test-owner',
                updated_at: new Date().toISOString()
            };
            
            await this.nc.publish('structs.test', JSON.stringify(testMessage));
            console.log('Test message published successfully');
        } catch (error) {
            console.error('Failed to test NATS connection:', error);
            throw error;
        }
    }
}

module.exports = new NATSService(); 