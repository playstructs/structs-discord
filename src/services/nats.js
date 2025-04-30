const { connect } = require('nats');
const { query } = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { EmbedBuilder } = require('discord.js');
const { formatUnit } = require('../utils/format');
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
                'SELECT DISTINCT channel_id, subscription FROM structs.discord_channel'
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
            // Clean up the subscription string by removing any quotes
            const cleanSubscription = subscription.replace(/['"]/g, '');
            console.log(`Subscribing channel ${channelId} to ${cleanSubscription}`);
            
            // Initialize Set if it doesn't exist
            if (!this.subscriptions.has(channelId)) {
                this.subscriptions.set(channelId, new Set());
            }

            // Check if subscription already exists
            const existingSubs = this.subscriptions.get(channelId);
            for (const sub of existingSubs) {
                if (sub.getSubject() === cleanSubscription) {
                    console.log(`Subscription ${cleanSubscription} already exists for channel ${channelId}`);
                    return true;
                }
            }

            // Create the subscription with a callback
            const sub = this.nc.subscribe(cleanSubscription, {
                callback: async (err, msg) => {
                    if (err) {
                        console.error(`Error in subscription callback for ${cleanSubscription}:`, err);
                        return;
                    }
                    console.log(`Received message for channel ${channelId} on ${cleanSubscription}`);
                    console.log('Message subject:', msg.subject);
                    console.log('Message data:', msg.data.toString());
                    await this.handleMessage(channelId, msg);
                }
            });
            
            // Add subscription to channel's Set
            this.subscriptions.get(channelId).add(sub);
            console.log(`Successfully subscribed channel ${channelId} to ${cleanSubscription}`);
            console.log(`Current subscriptions for channel ${channelId}:`, Array.from(this.subscriptions.get(channelId)).map(s => s.getSubject()));

            return true;
        } catch (error) {
            console.error(`Failed to subscribe ${channelId} to ${subscription}:`, error);
            return false;
        }
    }

    async unsubscribe(channelId, subscription) {
        try {
            // Clean up the subscription string by removing any quotes
            const cleanSubscription = subscription.replace(/['"]/g, '');
            console.log(`Unsubscribing channel ${channelId} from ${cleanSubscription}`);
            
            const channelSubs = this.subscriptions.get(channelId);
            if (!channelSubs) {
                console.log(`No subscriptions found for channel ${channelId}`);
                return true;
            }

            // Find and unsubscribe the specific subscription
            let found = false;
            for (const sub of channelSubs) {
                if (sub.getSubject() === cleanSubscription) {
                    console.log(`Found subscription ${cleanSubscription}, unsubscribing...`);
                    await sub.drain(); // Properly drain the subscription
                    sub.unsubscribe(); // Unsubscribe from NATS
                    channelSubs.delete(sub); // Remove from our tracking
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log(`Subscription ${cleanSubscription} not found for channel ${channelId}`);
            }

            // If no more subscriptions, remove the channel entry
            if (channelSubs.size === 0) {
                console.log(`No more subscriptions for channel ${channelId}, removing from tracking`);
                this.subscriptions.delete(channelId);
            }

            // Remove from database
            await query(
                'DELETE FROM structs.discord_channel WHERE channel_id = $1 AND subscription = $2',
                [channelId, subscription]
            );

            console.log(`Successfully unsubscribed channel ${channelId} from ${cleanSubscription}`);
            return true;
        } catch (error) {
            console.error(`Failed to unsubscribe ${channelId} from ${subscription}:`, error);
            return false;
        }
    }

    async handleMessage(channelId, msg) {
        try {
            console.log(`Handling message for channel ${channelId}`);
            if (!this.discordClient) {
                console.error('Discord client not initialized');
                return;
            }

            console.log(`Fetching Discord channel ${channelId}`);
            const channel = await this.discordClient.channels.fetch(channelId).catch(err => {
                console.error(`Error fetching Discord channel ${channelId}:`, err);
                return null;
            });
            
            if (!channel) {
                console.error(`Discord channel ${channelId} not found or bot lacks permissions`);
                return;
            }

            console.log('Raw message data:', msg.data);
            const data = JSON.parse(msg.data);
            console.log('Parsed message data:', JSON.stringify(data, null, 2));

            if (!data) {
                console.error('Message data is null or undefined');
                return;
            }

            // Helper function to get the correct timestamp
            const getTimestamp = (data) => {
                if (data.time) return new Date(data.time);
                if (data.updated_at) return new Date(data.updated_at);
                return new Date();
            };

            // Format message based on category and subject
            if (data.category === 'agreement') {
                const message = [
                    `${EMOJIS.STATUS.INFO} **Agreement Update**`,
                    `**Allocation ID:** ${data.allocation_id || 'N/A'}`,
                    `**Capacity:** ${data.capacity?.toString() || 'N/A'}`,
                    `**Start Block:** ${data.start_block?.toString() || 'N/A'}`,
                    `**End Block:** ${data.end_block?.toString() || 'N/A'}`,
                    `**Creator:** ${data.creator || 'N/A'}`,
                    `**Owner:** ${data.owner || 'N/A'}`
                ].join('\n');

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject?.startsWith('structs.grid.')) {
                const message = [
                    `${EMOJIS.STATUS.INFO} **Grid Update**`,
                    `**Object Type:** ${data.object_type || 'N/A'}`,
                    `**Object ID:** ${data.object_id || 'N/A'}`,
                    `**Attribute Type:** ${data.attribute_type || 'N/A'}`,
                    `**Value:** ${data.val?.toString() || 'N/A'}`
                ].join('\n');

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject?.startsWith('structs.guild.')) {
                let message;
                switch (data.category) {
                    case 'guild_consensus':
                        message = [
                            `${EMOJIS.STATUS.INFO} **Guild Consensus Update**`,
                            `**Guild ID:** ${data.id || 'N/A'}`,
                            `**Index:** ${data.index?.toString() || 'N/A'}`,
                            `**Endpoint:** ${data.endpoint || 'N/A'}`,
                            `**Join Infusion Min:** ${data.join_infusion_minimum_p?.toString() || 'N/A'}`,
                            `**Primary Reactor:** ${data.primary_reactor_id || 'N/A'}`,
                            `**Entry Substation:** ${data.entry_substation_id || 'N/A'}`
                        ].join('\n');
                        break;
                    case 'guild_meta':
                        message = [
                            `${EMOJIS.STATUS.INFO} **Guild Meta Update**`,
                            `**Guild ID:** ${data.id || 'N/A'}`,
                            `**Name:** ${data.name || 'N/A'}`,
                            `**Tag:** ${data.tag || 'N/A'}`,
                            `**Status:** ${data.status || 'N/A'}`,
                            `**Domain:** ${data.domain || 'N/A'}`,
                            `**Website:** ${data.website || 'N/A'}`
                        ].join('\n');
                        break;
                    case 'guild_membership':
                        message = [
                            `${EMOJIS.STATUS.INFO} **Guild Membership Update**`,
                            `**Guild ID:** ${data.guild_id || 'N/A'}`,
                            `**Player ID:** ${data.player_id || 'N/A'}`,
                            `**Join Type:** ${data.join_type || 'N/A'}`,
                            `**Status:** ${data.status || 'N/A'}`,
                            `**Proposer:** ${data.proposer || 'N/A'}`,
                            `**Substation:** ${data.substation_id || 'N/A'}`
                        ].join('\n');
                        break;
                    default:
                        message = [
                            `${EMOJIS.STATUS.INFO} **Guild Update**`,
                            `**Guild ID:** ${data.guild_id || 'N/A'}`,
                            `**Attribute Type:** ${data.attribute_type || 'N/A'}`,
                            `**Value:** ${data.val?.toString() || 'N/A'}`
                        ].join('\n');
                }

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject?.startsWith('structs.inventory.')) {
                //CREATE TYPE structs.ledger_action AS ENUM ('genesis','received','sent','migrated','infused','defused','mined','refined','seized','forfeited','minted','burned');
                if (data.category === 'received') {

                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.player_id]
                    );

                    const counterparty_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = (SELECT player_id FROM structs.player_address WHERE address = $1)',
                        [data.counterparty]
                    );

                    const message = [
                        `${EMOJIS.STATUS.INFO} **${player_discord_username.rows[0].discord_username || data.player_id}**`,
                        `received **${formatUnit(data.amount_p, data.denom)}**`,
                        `from **${counterparty_discord_username.rows[0].discord_username || data.counterparty}**`,
                        `(**Block Height:** ${data.block_height?.toString() || 'N/A'})`
                    ].join(' ');
                }  else if (data.category === 'sent') {

                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.player_id]
                    );

                    const counterparty_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = (SELECT player_id FROM structs.player_address WHERE address = $1)',
                        [data.counterparty]
                    );

                    const message = [
                        `${EMOJIS.STATUS.INFO} **${player_discord_username.rows[0].discord_username || data.player_id}**`,
                        `sent **${formatUnit(data.amount_p, data.denom)}**`,
                        `to **${counterparty_discord_username.rows[0].discord_username || data.counterparty}**`,
                        `(**Block Height:** ${data.block_height?.toString() || 'N/A'})`
                    ].join(' ');
                }

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject?.startsWith('structs.planet.')) {
                const message = [
                    `${EMOJIS.STATUS.INFO} **Planet Activity Update**`,
                    `**Planet ID:** ${data.planet_id || 'N/A'}`,
                    `**Sequence:** ${data.seq?.toString() || 'N/A'}`,
                    `**Category:** ${data.category || 'N/A'}`
                ].concat(
                    data.detail && !data.stub
                        ? Object.entries(data.detail).map(([key, value]) => 
                            `**${key}:** ${typeof value === 'object' ? JSON.stringify(value) : value.toString()}`
                        )
                        : []
                ).join('\n');

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject?.startsWith('structs.player.')) {
                let message;
                switch (data.category) {
                    case 'player_consensus':
                        message = [
                            `${EMOJIS.STATUS.INFO} **Player Consensus Update**`,
                            `**Player ID:** ${data.id || 'N/A'}`,
                            `**Index:** ${data.index?.toString() || 'N/A'}`,
                            `**Creator:** ${data.creator || 'N/A'}`,
                            `**Primary Address:** ${data.primary_address || 'N/A'}`,
                            `**Guild ID:** ${data.guild_id || 'N/A'}`,
                            `**Substation ID:** ${data.substation_id || 'N/A'}`,
                            `**Planet ID:** ${data.planet_id || 'N/A'}`,
                            `**Fleet ID:** ${data.fleet_id || 'N/A'}`
                        ].join('\n');
                        break;
                    case 'player_meta':
                        message = [
                            `${EMOJIS.STATUS.INFO} **Player Meta Update**`,
                            `**Player ID:** ${data.id || 'N/A'}`,
                            `**Guild ID:** ${data.guild_id || 'N/A'}`,
                            `**Username:** ${data.username || 'N/A'}`,
                            `**Status:** ${data.status || 'N/A'}`
                        ].join('\n');
                        break;
                    default:
                        message = [
                            `${EMOJIS.STATUS.INFO} **Player Update**`,
                            `**Player ID:** ${data.player_id || 'N/A'}`,
                            `**Attribute Type:** ${data.attribute_type || 'N/A'}`,
                            `**Value:** ${data.val?.toString() || 'N/A'}`
                        ].join('\n');
                }

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject?.startsWith('structs.provider.')) {
                const message = [
                    `${EMOJIS.STATUS.INFO} **Provider Update**`,
                    `**Provider ID:** ${data.id || 'N/A'}`,
                    `**Index:** ${data.index?.toString() || 'N/A'}`,
                    `**Substation ID:** ${data.substation_id || 'N/A'}`,
                    `**Rate:** ${data.rate_amount?.toString() || 'N/A'} ${data.rate_denom || ''}`,
                    `**Access Policy:** ${data.access_policy || 'N/A'}`,
                    `**Capacity Min:** ${data.capacity_minimum?.toString() || 'N/A'}`,
                    `**Capacity Max:** ${data.capacity_maximum?.toString() || 'N/A'}`,
                    `**Duration Min:** ${data.duration_minimum?.toString() || 'N/A'}`,
                    `**Duration Max:** ${data.duration_maximum?.toString() || 'N/A'}`,
                    `**Provider Cancel Penalty:** ${data.provider_cancellation_penalty?.toString() || 'N/A'}`,
                    `**Consumer Cancel Penalty:** ${data.consumer_cancellation_penalty?.toString() || 'N/A'}`,
                    `**Creator:** ${data.creator || 'N/A'}`,
                    `**Owner:** ${data.owner || 'N/A'}`
                ].join('\n');

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject === 'structs.consensus' && data.category === 'block') {
                const message = [
                    `${EMOJIS.STATUS.INFO} **Block Update**`,
                    `**Height:** ${data.height?.toString() || 'N/A'}`
                ].join('\n');

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else {
                let message;
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

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
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
            if (!this.isConnected) {
                throw new Error('NATS service is not connected');
            }

            // Publish a test message
            const testData = { test: 'message', timestamp: new Date().toISOString() };
            await this.nc.publish('test.connection', JSON.stringify(testData));
            console.log('Test message published successfully');

            return true;
        } catch (error) {
            console.error('Test connection failed:', error);
            return false;
        }
    }
}

module.exports = new NATSService(); 