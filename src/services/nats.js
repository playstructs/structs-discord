const { connect } = require('nats');
const { query } = require('../database');
const { EMOJIS } = require('../constants/emojis');

class NATSService {
    constructor() {
        this.nc = null;
        this.subscriptions = new Map(); // channelId -> Set of subscriptions
    }

    async initialize() {
        try {
            this.nc = await connect({
                servers: 'nats://structs-nats:4222'
            });
            console.log('Connected to NATS server');

            // Load existing subscriptions from database
            await this.loadSubscriptions();
        } catch (error) {
            console.error('Failed to connect to NATS:', error);
            throw error;
        }
    }

    async loadSubscriptions() {
        try {
            const result = await query(
                'SELECT channel_id, subscription FROM structs.discord_channel_subscriptions'
            );

            for (const row of result.rows) {
                await this.subscribe(row.channel_id, row.subscription);
            }
        } catch (error) {
            console.error('Failed to load subscriptions:', error);
        }
    }

    async subscribe(channelId, subscription) {
        try {
            const sub = this.nc.subscribe(subscription);
            
            // Initialize Set if it doesn't exist
            if (!this.subscriptions.has(channelId)) {
                this.subscriptions.set(channelId, new Set());
            }
            
            // Add subscription to channel's Set
            this.subscriptions.get(channelId).add(sub);

            (async () => {
                for await (const msg of sub) {
                    await this.handleMessage(channelId, msg);
                }
            })();

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
            const data = JSON.parse(msg.data);
            const channel = await this.nc.channels.fetch(channelId);

            if (!channel) {
                console.error(`Channel ${channelId} not found`);
                return;
            }

            // Format message based on category
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
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    async addSubscription(channelId, subscription) {
        try {
            // Add to database
            await query(
                'INSERT INTO structs.discord_channel_subscriptions (channel_id, subscription) VALUES ($1, $2)',
                [channelId, subscription]
            );

            // Subscribe to NATS
            return await this.subscribe(channelId, subscription);
        } catch (error) {
            console.error('Error adding subscription:', error);
            return false;
        }
    }

    async removeSubscription(channelId, subscription) {
        try {
            // Remove from database
            await query(
                'DELETE FROM structs.discord_channel_subscriptions WHERE channel_id = $1 AND subscription = $2',
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
                'SELECT subscription FROM structs.discord_channel_subscriptions WHERE channel_id = $1',
                [channelId]
            );
            return result.rows.map(row => row.subscription);
        } catch (error) {
            console.error('Error getting channel subscriptions:', error);
            return [];
        }
    }
}

module.exports = new NATSService(); 