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
                const discord_username = await query(
                    'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                    [data.owner]
                );

                const message = [
                    `${EMOJIS.SYSTEM.GRID} ${discord_username.rows[0]?.discord_username || data.owner} Set Agreement ${data.agreement_id}`,
                    `(Allocation ID: ${data.allocation_id})`,
                    `with Provider ${data.provider_id}`,
                    `of ${await formatUnit(data.capacity, 'milliwatt')}`,
                    `for blocks${data.start_block?.toString()} to ${data.end_block?.toString()}`
                ].join(' ');

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject?.startsWith('structs.grid.')) {
                /* 
                enum gridAttributeType {
                    ore                     = 0;
                    fuel                    = 1;
                    capacity                = 2;
                    load                    = 3;
                    structsLoad             = 4;
                    power                   = 5;
                    connectionCapacity      = 6;
                    connectionCount         = 7;
                    allocationPointerStart  = 8;
                    allocationPointerEnd    = 9;
                    proxyNonce              = 10;
                    lastAction              = 11;
                    nonce                   = 12;
                    ready                   = 13;
                    checkpointBlock         = 14;
                }
                */

                if (data.attribute_type === 'ore') {
                    if (data.object_type === 'player') {
                        const player_discord_username = await query(
                            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                            [data.object_id]
                        );

                        const message = [
                            `${EMOJIS.SYSTEM.GRID}`,
                            `${player_discord_username.rows[0]?.discord_username || data.object_id}`,
                            `Ore hoard change from ${await formatUnit(data.value_old,'ore')} to ${await formatUnit(data.value,'ore')}`
                        ].join(' ');
                        try {
                            await channel.send(message);
                        } catch (err) {
                            console.error('Error sending message to Discord:', err);
                        }
                    } else {
                        const message = [
                            `${EMOJIS.SYSTEM.GRID}`,
                            `Remaining Ore Detected on Planet ${data.object_id}`,
                            `${await formatUnit(data.value,'ore')}`
                        ].join(' ');      
                        try {
                            await channel.send(message);
                        } catch (err) {
                            console.error('Error sending message to Discord:', err);
                        }              
                    }


                } else if (data.attribute_type === 'fuel') {
                    let message;
                    if (data.object_type === 'struct') {
                         message = [
                            `${EMOJIS.SYSTEM.GRID} ${await formatUnit(data.value_old,'ore')} fuel`,
                            `added to Generating Struct ${data.object_id}`
                        ].join(' ');
                        try {
                            await channel.send(message);
                        } catch (err) {
                            console.error('Error sending message to Discord:', err);
                        }
                    } else {
                         message = [
                            `${EMOJIS.SYSTEM.GRID} Reactor Fuel Change`,
                            `${await formatUnit(data.value_old,'ore')}`,
                            `to`,
                            `${await formatUnit(data.value,'ore')}`
                        ].join(' ');

                    }
                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }

                } else if (data.attribute_type === 'capacity') {
                    const message = [
                        `${EMOJIS.SYSTEM.GRID} Capacity Change`,
                        `${await formatUnit(data.value_old,'milliwatt')}`,
                        `to ${await formatUnit(data.value,'milliwatt')}`,
                        `for ${data.object_type} ${data.object_id}`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.attribute_type === 'load') {
                    const message = [
                        `${EMOJIS.SYSTEM.GRID} Load Change`,
                        `${await formatUnit(data.value_old,'milliwatt')}`,
                        `to ${await formatUnit(data.value,'milliwatt')}`,
                        `for ${data.object_type} ${data.object_id}`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.attribute_type === 'structsLoad') {
                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.object_id]
                    );

                    const message = [
                        `${EMOJIS.SYSTEM.GRID} Structs Load Change `,
                        `${await formatUnit(data.value_old,'milliwatt')}`,
                        `to ${await formatUnit(data.value,'milliwatt')}`,
                        `for ${player_discord_username.rows[0]?.discord_username || data.object_id}`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.attribute_type === 'power') {
                    const message = [
                        `${EMOJIS.SYSTEM.GRID} Allocation Capacity by`,
                        `${data.object_id}`,
                        `changed from`,
                        `${await formatUnit(data.value_old,'milliwatt')}`,
                        `to`,
                        `${await formatUnit(data.value,'milliwatt')}`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.attribute_type === 'connectionCapacity') {
                    const message = [
                        `${EMOJIS.SYSTEM.GRID} Connection Capacity Change`,
                        `${await formatUnit(data.value_old,'milliwatt')}`,
                        `to ${await formatUnit(data.value,'milliwatt')}`,
                        `for Substation ${data.object_id}`  
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.attribute_type === 'connectionCount') {
                    const message = [
                        `${EMOJIS.SYSTEM.GRID} Connection Count Change`,
                        `${data.value_old?.toString() || 'N/A'}`,
                        `to ${data.value?.toString() || 'N/A'}`,
                        `for Substation ${data.object_id}`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                }

            } else if (data.subject?.startsWith('structs.guild.')) {
                let message;
                const guild_details = await query(
                    'SELECT name, tag FROM structs.guild_meta WHERE id = $1',
                    [data.id]
                );
                switch (data.category) {
                    case 'guild_consensus':
                        message = [
                            `${EMOJIS.SYSTEM.GUILD}`,
                            `${guild_details.rows[0]?.name}[${guild_details.rows[0]?.tag}](${data.id})`,
                            `**Endpoint:** ${data.endpoint || 'N/A'}`,
                            `**Join Infusion Min:** ${data.join_infusion_minimum_p?.toString() || 'N/A'}`,
                            `**Primary Reactor:** ${data.primary_reactor_id || 'N/A'}`,
                            `**Entry Substation:** ${data.entry_substation_id || 'N/A'}`
                        ].join(' ');
                        break;
                    case 'guild_meta':
                        message = [
                            `${EMOJIS.SYSTEM.GUILD}`,
                            `**Guild ID:** ${data.id || 'N/A'}`,
                            `**Name:** ${data.name || 'N/A'}`,
                            `**Tag:** ${data.tag || 'N/A'}`,
                            `**Status:** ${data.status || 'N/A'}`,
                            `**Domain:** ${data.domain || 'N/A'}`,
                            `**Website:** ${data.website || 'N/A'}`
                        ].join(' ');
                        break;
                    case 'guild_membership':

                        const player_discord_username = await query(
                            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                            [data.player_id]
                        );

                        const proposer_discord_username = await query(
                            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                            [data.proposer]
                        );

                        message = [
                            `${EMOJIS.SYSTEM.GUILD}`,
                            `${guild_details.rows[0]?.name}[${guild_details.rows[0]?.tag}](${data.id})`,
                            `Membership Application for ${player_discord_username.rows[0]?.discord_username || data.player_id}`,
                            `**Join Type:** ${data.join_type || 'N/A'}`,
                            `**Status:** ${data.status || 'N/A'}`,
                            `**Proposer:** ${proposer_discord_username.rows[0]?.discord_username || data.proposer}`,
                            `**Substation:** ${data.substation_id || 'N/A'}`
                        ].join(' ');
                        break;
                    default:
                        message = [
                            `${EMOJIS.SYSTEM.GUILD} **Guild Update**`,
                            `**Guild ID:** ${data.guild_id || 'N/A'}`,
                            `**Attribute Type:** ${data.attribute_type || 'N/A'}`,
                            `**Value:** ${data.val?.toString() || 'N/A'}`
                        ].join(' ');
                }

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject?.startsWith('structs.inventory.')) {
                //CREATE TYPE structs.ledger_action AS ENUM ('genesis','received','sent','migrated','infused','defused','mined','refined','seized','forfeited','minted','burned');
                if (data.category === 'received') {
                    // Ignore this one and only process Sent
                } else if (data.category === 'sent') {

                    if (data.address === 'structs1rwfvu2k78ajl5nljj8hfl79zmm0l96xyqw0tc9') {
                        return;
                    }

                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.player_id]
                    );

                    const player_guild_tag = await query(
                        'SELECT tag FROM structs.guild_meta WHERE id = $1',
                        [data.guild_id]
                    );

                    const counterparty_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.counterparty_player_id]
                    );

                    const counterparty_guild_tag = await query(
                        'SELECT tag FROM structs.guild_meta WHERE id = $1',
                        [data.counterparty_guild_id]
                    );

                    const message = [
                        `**${player_discord_username.rows[0]?.discord_username || data.player_id}[${player_guild_tag.rows[0]?.tag}]**`,
                        `sent **${await formatUnit(data.amount_p, data.denom)}**`,
                        `to **${counterparty_discord_username.rows[0]?.discord_username || data.counterparty_player_id}[${counterparty_guild_tag.rows[0]?.tag}]**`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.category === 'infused') {
                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.player_id]
                    );

                    const player_guild_tag = await query(
                        'SELECT tag FROM structs.guild_meta WHERE id = $1',
                        [data.guild_id]
                    );

                    const reactor_id = data.object_id.split('-')[0] + '-' + data.object_id.split('-')[1]; // Extract "3-29" from "3-29-structs1p4kydpytjzxdq0wvnwu95mwuet3rssj03arj7x"

                    const message = [
                        `**${player_discord_username.rows[0]?.discord_username || data.player_id}[${player_guild_tag.rows[0]?.tag}]**`,
                        `infused **${await formatUnit(data.amount_p, data.denom)}**`,
                        `into **${reactor_id}**`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.category === 'defused') {
                 
                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.player_id]
                    );

                    const player_guild_tag = await query(
                        'SELECT tag FROM structs.guild_meta WHERE id = $1',
                        [data.guild_id]
                    );

                    const reactor_id = data.object_id.split('-')[0] + '-' + data.object_id.split('-')[1]; // Extract "3-29" from "3-29-structs1p4kydpytjzxdq0wvnwu95mwuet3rssj03arj7x"

                    const message = [
                        `**${player_discord_username.rows[0]?.discord_username || data.player_id}[${player_guild_tag.rows[0]?.tag}]**`,
                        `defused **${await formatUnit(data.amount_p, data.denom)}**`,
                        `from **${reactor_id}**`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.category === 'mined') {
                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.player_id]
                    );

                    const player_guild_tag = await query(
                        'SELECT tag FROM structs.guild_meta WHERE id = $1',
                        [data.guild_id]
                    );

                    const message = [
                        `**${player_discord_username.rows[0]?.discord_username || data.player_id}[${player_guild_tag.rows[0]?.tag}]**`,
                        `mined **${await formatUnit(data.amount_p, data.denom)}**`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.category === 'refined') {
                    if (data.direction === 'debit') {
                        const player_discord_username = await query(
                            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                            [data.player_id]
                        );

                        const player_guild_tag = await query(
                            'SELECT tag FROM structs.guild_meta WHERE id = $1',
                            [data.guild_id]
                        );

                        const message = [
                            `**${player_discord_username.rows[0]?.discord_username || data.player_id}[${player_guild_tag.rows[0]?.tag}]**`,
                            `refined **${await formatUnit(data.amount_p, data.denom)}**`,
                            `into **${await formatUnit(data.amount_p*1000000, 'ualpha')}**`
                        ].join(' ');

                        try {
                            await channel.send(message);
                        } catch (err) {
                            console.error('Error sending message to Discord:', err);
                        }
                    }
                } else if (data.category === 'seized') {
                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.player_id]
                    );

                    const player_guild_tag = await query(
                        'SELECT tag FROM structs.guild_meta WHERE id = $1',
                        [data.guild_id]
                    );

                    const counterparty_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.counterparty_player_id]
                    );

                    const counterparty_guild_tag = await query(
                        'SELECT tag FROM structs.guild_meta WHERE id = $1',
                        [data.counterparty_guild_id]
                    );

                    const message = [
                        `**${player_discord_username.rows[0]?.discord_username || data.player_id}[${player_guild_tag.rows[0]?.tag}]**`,
                        `seized **${await formatUnit(data.amount_p, data.denom)}**`,
                        `from **${counterparty_discord_username.rows[0]?.discord_username || data.counterparty_player_id}[${counterparty_guild_tag.rows[0]?.tag}]**`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.category === 'minted') {
                    if (data.address === 'structs1rwfvu2k78ajl5nljj8hfl79zmm0l96xyqw0tc9') {
                        return;
                    }

                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.player_id]
                    );

                    const player_guild_tag = await query(
                        'SELECT tag FROM structs.guild_meta WHERE id = $1',
                        [data.guild_id]
                    );

                    const message = [
                        `**${player_discord_username.rows[0]?.discord_username || data.player_id}[${player_guild_tag.rows[0]?.tag}]**`,
                        `minted **${await formatUnit(data.amount_p, data.denom)}**`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                } else if (data.category === 'burned') {
                    const player_discord_username = await query(
                        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                        [data.player_id]
                    );

                    const player_guild_tag = await query(
                        'SELECT tag FROM structs.guild_meta WHERE id = $1',
                        [data.guild_id]
                    );

                    const message = [
                        `**${player_discord_username.rows[0]?.discord_username || data.player_id}[${player_guild_tag.rows[0]?.tag}]**`,
                        `burned **${await formatUnit(data.amount_p, data.denom)}**`
                    ].join(' ');

                    try {
                        await channel.send(message);
                    } catch (err) {
                        console.error('Error sending message to Discord:', err);
                    }
                }
            } else if (data.subject?.startsWith('structs.planet.')) {
                let message;

                /*         -- Planet Activity
                'raid_status',
                'fleet_arrive',
                'fleet_advance',
                'fleet_depart',
                'struct_attack',
                'struct_defense_remove',
                'struct_defense_add',
                'struct_status',
                'struct_move',
                'struct_block_build_start',
                'struct_block_ore_mine_start',
                'struct_block_ore_refine_start',
                */

                if (data.category === 'raid_status') {

                } else if (data.category === 'fleet_arrive') {

                } else if (data.category === 'fleet_advance') {

                } else if (data.category === 'fleet_depart') {

                } else if (data.category === 'struct_attack') {

                } else if (data.category === 'struct_defense_remove') {

                } else if (data.category === 'struct_defense_add') {
                    
                } else if (data.category === 'struct_status') {

                } else if (data.category === 'struct_move') {

                } else if (data.category === 'struct_block_build_start') {
                    const player_discord_details = await query(
                        'SELECT discord_username, guild_meta.tag as guild_tag FROM structs.player_discord, structs.player, structs.guild_meta WHERE player_discord.player_id = player.id AND player.guild_id = guild_meta.id AND player.planet_id = $1',
                        [data.planet_id]
                    );

                     message = [
                        `${EMOJIS.SYSTEM.PLANET} `,
                        `${player_discord_details.rows[0]?.discord_username || data.player_id}[${player_discord_details.rows[0]?.guild_tag}]`,
                        `Struct Build Initiated ${data.planet_id || 'N/A'}`,
                        `For ${data.struct_id || 'N/A'}`,
                        `At ${data.details.block}`
                    ].join(' ');
                    
                } else if (data.category === 'struct_block_ore_mine_start') {
                    const player_discord_details = await query(
                        'SELECT discord_username, guild_meta.tag as guild_tag FROM structs.player_discord, structs.player, structs.guild_meta WHERE player_discord.player_id = player.id AND player.guild_id = guild_meta.id AND player.planet_id = $1',
                        [data.planet_id]
                    );

                     message = [
                        `${EMOJIS.SYSTEM.PLANET} `,
                        `${player_discord_details.rows[0]?.discord_username || data.player_id}[${player_discord_details.rows[0]?.guild_tag}]`,
                        `Mining Initiated ${data.planet_id || 'N/A'}`,
                        `By ${EMOJIS.STRUCT.MINER} ${data.struct_id || 'N/A'}`,
                        `At ${data.details.block}`
                    ].join(' ');

                } else if (data.category === 'struct_block_ore_refine_start') {
                    const player_discord_details = await query(
                        'SELECT discord_username, guild_meta.tag as guild_tag FROM structs.player_discord, structs.player, structs.guild_meta WHERE player_discord.player_id = player.id AND player.guild_id = guild_meta.id AND player.planet_id = $1',
                        [data.planet_id]
                    );

                     message = [
                        `${EMOJIS.SYSTEM.PLANET} `,
                        `${player_discord_details.rows[0]?.discord_username || data.player_id}[${player_discord_details.rows[0]?.guild_tag}]`,
                        `Refinement Initiated ${data.planet_id || 'N/A'}`,
                        `By ${EMOJIS.STRUCT.REFINERY} ${data.struct_id || 'N/A'}`,
                        `At ${data.details.block}`
                    ].join(' ');
                } else {
                     message = [
                        `${EMOJIS.SYSTEM.PLANET}`,
                        `**Planet ID:** ${data.planet_id || 'N/A'}`,
                        `**Category:** ${data.category || 'N/A'}`
                    ].concat(
                        data.detail && !data.stub
                            ? Object.entries(data.detail).map(([key, value]) => 
                                `**${key}:** ${typeof value === 'object' ? JSON.stringify(value) : value.toString()}`
                            )
                            : []
                    ).join(' ');
                }

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject?.startsWith('structs.player.')) {
                let message;
                switch (data.category) {
                    case 'player_consensus':
                        const discord_username = await query(
                            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                            [data.id]
                        );

                        const guild_details = await query(
                            'SELECT tag FROM structs.guild_meta WHERE id = $1',
                            [data.guild_id]
                        );

                        message = [
                            `${EMOJIS.SYSTEM.MEMBER_DIRECTORY}`,
                            `${discord_username.rows[0]?.discord_username || data.id}[${guild_details.rows[0]?.tag}]`,
                            `${EMOJIS.SYSTEM.GRID}:${data.substation_id || 'N/A'}`,
                            `${EMOJIS.SYSTEM.PLANET}:${data.planet_id || 'N/A'}`,
                            `${EMOJIS.SYSTEM.FLEET}:${data.fleet_id || 'N/A'}`
                        ].join(' ');
                        break;
                    case 'player_meta':
                        message = [
                            `${EMOJIS.SYSTEM.MEMBER_DIRECTORY} **Player Meta Update**`,
                            `**Player ID:** ${data.id || 'N/A'}`,
                            `**Guild ID:** ${data.guild_id || 'N/A'}`,
                            `**Username:** ${data.username || 'N/A'}`,
                            `**Status:** ${data.status || 'N/A'}`
                        ].join(' ');
                        break;
                    default:
                        message = [
                            `${EMOJIS.STATUS.INFO} **Player Update**`,
                            `**Player ID:** ${data.player_id || 'N/A'}`,
                            `**Attribute Type:** ${data.attribute_type || 'N/A'}`,
                            `**Value:** ${data.val?.toString() || 'N/A'}`
                        ].join(' ');
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
                    `**Substation ID:** ${data.substation_id || 'N/A'}`,
                    `**Rate:** ${data.rate_amount?.toString() || 'N/A'} ${data.rate_denom || ''}`,
                    `**Access Policy:** ${data.access_policy || 'N/A'}`,
                    `**Capacity Min:** ${data.capacity_minimum?.toString() || 'N/A'}`,
                    `**Capacity Max:** ${data.capacity_maximum?.toString() || 'N/A'}`,
                    `**Duration Min:** ${data.duration_minimum?.toString() || 'N/A'}`,
                    `**Duration Max:** ${data.duration_maximum?.toString() || 'N/A'}`,
                    `**Provider Cancel Penalty:** ${data.provider_cancellation_penalty?.toString() || 'N/A'}`,
                    `**Consumer Cancel Penalty:** ${data.consumer_cancellation_penalty?.toString() || 'N/A'}`,
                    `**Owner:** ${data.owner || 'N/A'}`
                ].join(' ');

                try {
                    await channel.send(message);
                } catch (err) {
                    console.error('Error sending message to Discord:', err);
                }
            } else if (data.subject === 'consensus' && data.category === 'block') {
                const message = [
                    `${EMOJIS.STATUS.INFO} **Block Update**`,
                    `**Height:** ${data.height?.toString() || 'N/A'}`
                ].join(' ');

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