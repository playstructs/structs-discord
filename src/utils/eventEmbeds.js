const { EmbedBuilder } = require('discord.js');
const { EMOJIS } = require('../constants/emojis');
const { formatUnit, formatStructStatus, formatStructType, formatOperatingAmbit } = require('./format');
const { query } = require('../database');

/**
 * Get color for event type
 * @param {string} eventType - Type of event
 * @returns {number} Color code for embed
 */
function getEventColor(eventType) {
    const colors = {
        success: 0x00ff00,      // Green
        warning: 0xffaa00,      // Orange/Yellow
        error: 0xff0000,        // Red
        info: 0x0099ff,         // Blue
        attack: 0xff4444,       // Red for attacks
        defense: 0x44ff44,      // Green for defense
        fleet: 0x4444ff,        // Blue for fleet
        struct: 0xffaa00,       // Orange for structs
        planet: 0x00ffff,       // Cyan for planets
        inventory: 0xaa00ff,    // Purple for inventory
        guild: 0xff00aa,        // Pink for guild
        grid: 0x00ffaa          // Teal for grid
    };
    
    if (eventType.includes('attack') || eventType.includes('raid') || eventType.includes('seized')) {
        return colors.attack;
    }
    if (eventType.includes('defense') || eventType.includes('protect')) {
        return colors.defense;
    }
    if (eventType.includes('fleet')) {
        return colors.fleet;
    }
    if (eventType.includes('struct')) {
        return colors.struct;
    }
    if (eventType.includes('planet')) {
        return colors.planet;
    }
    if (eventType.includes('inventory') || eventType.includes('sent') || eventType.includes('received')) {
        return colors.inventory;
    }
    if (eventType.includes('guild')) {
        return colors.guild;
    }
    if (eventType.includes('grid') || eventType.includes('ore') || eventType.includes('capacity') || eventType.includes('load')) {
        return colors.grid;
    }
    
    return colors.info;
}

/**
 * Create embed for agreement events
 */
async function createAgreementEmbed(data) {
    const discord_username = await query(
        'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
        [data.owner]
    );

    const embed = new EmbedBuilder()
        .setColor(getEventColor('agreement'))
        .setTitle(`${EMOJIS.SYSTEM.GRID} Agreement Created`)
        .setDescription(`${discord_username.rows[0]?.discord_username || data.owner} set Agreement ${data.agreement_id}`)
        .addFields(
            { name: 'Agreement ID', value: data.agreement_id, inline: true },
            { name: 'Allocation ID', value: data.allocation_id, inline: true },
            { name: 'Provider ID', value: data.provider_id, inline: true },
            { name: 'Capacity', value: await formatUnit(data.capacity, 'milliwatt'), inline: true },
            { name: 'Start Block', value: data.start_block?.toString() || 'N/A', inline: true },
            { name: 'End Block', value: data.end_block?.toString() || 'N/A', inline: true }
        )
        .setTimestamp(data.time ? new Date(data.time) : new Date());

    return embed;
}

/**
 * Create embed for grid events
 */
async function createGridEmbed(data) {
    const embed = new EmbedBuilder()
        .setColor(getEventColor('grid'))
        .setTimestamp(data.time ? new Date(data.time) : new Date());

    if (data.attribute_type === 'ore') {
        if (data.object_type === 'player') {
            const player_discord_username = await query(
                'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                [data.object_id]
            );

            embed.setTitle(`${EMOJIS.SYSTEM.GRID} Ore Hoard Change`)
                .setDescription(`${player_discord_username.rows[0]?.discord_username || data.object_id}`)
                .addFields(
                    { name: 'Previous Amount', value: await formatUnit(data.value_old, 'ore'), inline: true },
                    { name: 'New Amount', value: await formatUnit(data.value, 'ore'), inline: true },
                    { name: 'Change', value: await formatUnit(data.value - data.value_old, 'ore'), inline: true }
                );
        } else {
            embed.setTitle(`${EMOJIS.SYSTEM.GRID} Remaining Ore Detected`)
                .setDescription(`Planet ${data.object_id}`)
                .addFields(
                    { name: 'Ore Amount', value: await formatUnit(data.value, 'ore'), inline: true }
                );
        }
    } else if (data.attribute_type === 'fuel') {
        if (data.object_type === 'struct') {
            embed.setTitle(`${EMOJIS.SYSTEM.GRID} Fuel Added`)
                .setDescription(`Generating Struct ${data.object_id}`)
                .addFields(
                    { name: 'Fuel Amount', value: await formatUnit(data.value_old, 'ore'), inline: true }
                );
        } else {
            embed.setTitle(`${EMOJIS.SYSTEM.GRID} Reactor Fuel Change`)
                .addFields(
                    { name: 'Previous', value: await formatUnit(data.value_old, 'ore'), inline: true },
                    { name: 'Current', value: await formatUnit(data.value, 'ore'), inline: true }
                );
        }
    } else if (data.attribute_type === 'capacity') {
        embed.setTitle(`${EMOJIS.SYSTEM.GRID} Capacity Change`)
            .setDescription(`${data.object_type} ${data.object_id}`)
            .addFields(
                { name: 'Previous', value: await formatUnit(data.value_old, 'milliwatt'), inline: true },
                { name: 'Current', value: await formatUnit(data.value, 'milliwatt'), inline: true },
                { name: 'Change', value: await formatUnit(data.value - data.value_old, 'milliwatt'), inline: true }
            );
    } else if (data.attribute_type === 'load') {
        embed.setTitle(`${EMOJIS.SYSTEM.GRID} Load Change`)
            .setDescription(`${data.object_type} ${data.object_id}`)
            .addFields(
                { name: 'Previous', value: await formatUnit(data.value_old, 'milliwatt'), inline: true },
                { name: 'Current', value: await formatUnit(data.value, 'milliwatt'), inline: true },
                { name: 'Change', value: await formatUnit(data.value - data.value_old, 'milliwatt'), inline: true }
            );
    } else if (data.attribute_type === 'structsLoad') {
        const player_discord_username = await query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [data.object_id]
        );

        embed.setTitle(`${EMOJIS.SYSTEM.GRID} Structs Load Change`)
            .setDescription(`${player_discord_username.rows[0]?.discord_username || data.object_id}`)
            .addFields(
                { name: 'Previous', value: await formatUnit(data.value_old, 'milliwatt'), inline: true },
                { name: 'Current', value: await formatUnit(data.value, 'milliwatt'), inline: true },
                { name: 'Change', value: await formatUnit(data.value - data.value_old, 'milliwatt'), inline: true }
            );
    } else if (data.attribute_type === 'power') {
        embed.setTitle(`${EMOJIS.SYSTEM.GRID} Allocation Capacity Change`)
            .setDescription(`Allocation ${data.object_id}`)
            .addFields(
                { name: 'Previous', value: await formatUnit(data.value_old, 'milliwatt'), inline: true },
                { name: 'Current', value: await formatUnit(data.value, 'milliwatt'), inline: true },
                { name: 'Change', value: await formatUnit(data.value - data.value_old, 'milliwatt'), inline: true }
            );
    } else if (data.attribute_type === 'connectionCapacity') {
        embed.setTitle(`${EMOJIS.SYSTEM.GRID} Connection Capacity Change`)
            .setDescription(`Substation ${data.object_id}`)
            .addFields(
                { name: 'Previous', value: await formatUnit(data.value_old, 'milliwatt'), inline: true },
                { name: 'Current', value: await formatUnit(data.value, 'milliwatt'), inline: true },
                { name: 'Change', value: await formatUnit(data.value - data.value_old, 'milliwatt'), inline: true }
            );
    } else if (data.attribute_type === 'connectionCount') {
        embed.setTitle(`${EMOJIS.SYSTEM.GRID} Connection Count Change`)
            .setDescription(`Substation ${data.object_id}`)
            .addFields(
                { name: 'Previous', value: data.value_old?.toString() || 'N/A', inline: true },
                { name: 'Current', value: data.value?.toString() || 'N/A', inline: true }
            );
    }

    return embed;
}

/**
 * Create embed for guild events
 */
async function createGuildEmbed(data) {
    const guild_details = await query(
        'SELECT name, tag FROM structs.guild_meta WHERE id = $1',
        [data.id]
    );

    const embed = new EmbedBuilder()
        .setColor(getEventColor('guild'))
        .setTimestamp(data.time ? new Date(data.time) : new Date());

    if (data.category === 'guild_consensus') {
        embed.setTitle(`${EMOJIS.SYSTEM.GUILD} Guild Consensus Update`)
            .setDescription(`${guild_details.rows[0]?.name || 'Unknown'}[${guild_details.rows[0]?.tag || 'N/A'}] (${data.id})`)
            .addFields(
                { name: 'Endpoint', value: data.endpoint || 'N/A', inline: true },
                { name: 'Join Infusion Min', value: data.join_infusion_minimum_p?.toString() || 'N/A', inline: true },
                { name: 'Primary Reactor', value: data.primary_reactor_id || 'N/A', inline: true },
                { name: 'Entry Substation', value: data.entry_substation_id || 'N/A', inline: true }
            );
    } else if (data.category === 'guild_meta') {
        embed.setTitle(`${EMOJIS.SYSTEM.GUILD} Guild Meta Update`)
            .setDescription(`${guild_details.rows[0]?.name || data.name || 'Unknown'}[${guild_details.rows[0]?.tag || data.tag || 'N/A'}]`)
            .addFields(
                { name: 'Guild ID', value: data.id || 'N/A', inline: true },
                { name: 'Name', value: data.name || 'N/A', inline: true },
                { name: 'Tag', value: data.tag || 'N/A', inline: true },
                { name: 'Status', value: data.status || 'N/A', inline: true },
                { name: 'Domain', value: data.domain || 'N/A', inline: true },
                { name: 'Website', value: data.website || 'N/A', inline: true }
            );
    } else if (data.category === 'guild_membership') {
        const player_discord_username = await query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [data.player_id]
        );

        const proposer_discord_username = await query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [data.proposer]
        );

        embed.setTitle(`${EMOJIS.SYSTEM.GUILD} Membership Application`)
            .setDescription(`${guild_details.rows[0]?.name || 'Unknown'}[${guild_details.rows[0]?.tag || 'N/A'}] (${data.id})`)
            .addFields(
                { name: 'Player', value: player_discord_username.rows[0]?.discord_username || data.player_id, inline: true },
                { name: 'Join Type', value: data.join_type || 'N/A', inline: true },
                { name: 'Status', value: data.status || 'N/A', inline: true },
                { name: 'Proposer', value: proposer_discord_username.rows[0]?.discord_username || data.proposer, inline: true },
                { name: 'Substation', value: data.substation_id || 'N/A', inline: true }
            );
    } else {
        embed.setTitle(`${EMOJIS.SYSTEM.GUILD} Guild Update`)
            .setDescription(`Guild ID: ${data.guild_id || data.id || 'N/A'}`)
            .addFields(
                { name: 'Attribute Type', value: data.attribute_type || 'N/A', inline: true },
                { name: 'Value', value: data.val?.toString() || 'N/A', inline: true }
            );
    }

    return embed;
}

/**
 * Create embed for inventory events
 */
async function createInventoryEmbed(data) {
    const embed = new EmbedBuilder()
        .setColor(getEventColor('inventory'))
        .setTimestamp(data.time ? new Date(data.time) : new Date());

    if (data.category === 'sent') {
        if (data.address === 'structs1rwfvu2k78ajl5nljj8hfl79zmm0l96xyqw0tc9') {
            return null; // Skip system address
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

        embed.setTitle(`${EMOJIS.SYSTEM.GRID} Resource Transfer`)
            .setDescription(`**${player_discord_username.rows[0]?.discord_username || data.player_id}** [${player_guild_tag.rows[0]?.tag || 'N/A'}] sent resources`)
            .addFields(
                { name: 'Amount', value: await formatUnit(data.amount_p, data.denom), inline: true },
                { name: 'To', value: `**${counterparty_discord_username.rows[0]?.discord_username || data.counterparty_player_id}** [${counterparty_guild_tag.rows[0]?.tag || 'N/A'}]`, inline: false }
            );
    } else if (data.category === 'infused') {
        const player_discord_username = await query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [data.player_id]
        );

        const player_guild_tag = await query(
            'SELECT tag FROM structs.guild_meta WHERE id = $1',
            [data.guild_id]
        );

        const reactor_id = data.object_id.split('-')[0] + '-' + data.object_id.split('-')[1];

        embed.setTitle(`${EMOJIS.SYSTEM.GRID} Power Infusion`)
            .setDescription(`**${player_discord_username.rows[0]?.discord_username || data.player_id}** [${player_guild_tag.rows[0]?.tag || 'N/A'}] infused resources`)
            .addFields(
                { name: 'Amount', value: await formatUnit(data.amount_p, data.denom), inline: true },
                { name: 'Into Reactor', value: reactor_id, inline: true }
            );
    } else if (data.category === 'defused') {
        const player_discord_username = await query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [data.player_id]
        );

        const player_guild_tag = await query(
            'SELECT tag FROM structs.guild_meta WHERE id = $1',
            [data.guild_id]
        );

        const reactor_id = data.object_id.split('-')[0] + '-' + data.object_id.split('-')[1];

        embed.setTitle(`${EMOJIS.SYSTEM.GRID} Power Defusion`)
            .setDescription(`**${player_discord_username.rows[0]?.discord_username || data.player_id}** [${player_guild_tag.rows[0]?.tag || 'N/A'}] defused resources`)
            .addFields(
                { name: 'Amount', value: await formatUnit(data.amount_p, data.denom), inline: true },
                { name: 'From Reactor', value: reactor_id, inline: true }
            );
    } else if (data.category === 'mined') {
        const player_discord_username = await query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [data.player_id]
        );

        const player_guild_tag = await query(
            'SELECT tag FROM structs.guild_meta WHERE id = $1',
            [data.guild_id]
        );

        embed.setTitle(`${EMOJIS.CURRENCY.ORE} Ore Mined`)
            .setDescription(`**${player_discord_username.rows[0]?.discord_username || data.player_id}** [${player_guild_tag.rows[0]?.tag || 'N/A'}] mined ore`)
            .addFields(
                { name: 'Amount', value: await formatUnit(data.amount_p, data.denom), inline: true }
            );
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

            embed.setTitle(`${EMOJIS.CURRENCY.ALPHA} Ore Refined`)
                .setDescription(`**${player_discord_username.rows[0]?.discord_username || data.player_id}** [${player_guild_tag.rows[0]?.tag || 'N/A'}] refined ore`)
                .addFields(
                    { name: 'Ore Used', value: await formatUnit(data.amount_p, data.denom), inline: true },
                    { name: 'Alpha Produced', value: await formatUnit(data.amount_p * 1000000, 'ualpha'), inline: true }
                );
        } else {
            return null;
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

        embed.setTitle(`${EMOJIS.STATUS.WARNING} Resources Seized`)
            .setDescription(`**${player_discord_username.rows[0]?.discord_username || data.player_id}** [${player_guild_tag.rows[0]?.tag || 'N/A'}] seized resources`)
            .addFields(
                { name: 'Amount', value: await formatUnit(data.amount_p, data.denom), inline: true },
                { name: 'From', value: `**${counterparty_discord_username.rows[0]?.discord_username || data.counterparty_player_id}** [${counterparty_guild_tag.rows[0]?.tag || 'N/A'}]`, inline: false }
            );
    } else if (data.category === 'minted') {
        if (data.address === 'structs1rwfvu2k78ajl5nljj8hfl79zmm0l96xyqw0tc9') {
            return null; // Skip system address
        }

        const player_discord_username = await query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [data.player_id]
        );

        const player_guild_tag = await query(
            'SELECT tag FROM structs.guild_meta WHERE id = $1',
            [data.guild_id]
        );

        embed.setTitle(`${EMOJIS.SYSTEM.GUILD} Tokens Minted`)
            .setDescription(`**${player_discord_username.rows[0]?.discord_username || data.player_id}** [${player_guild_tag.rows[0]?.tag || 'N/A'}] minted tokens`)
            .addFields(
                { name: 'Amount', value: await formatUnit(data.amount_p, data.denom), inline: true }
            );
    } else if (data.category === 'burned') {
        const player_discord_username = await query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [data.player_id]
        );

        const player_guild_tag = await query(
            'SELECT tag FROM structs.guild_meta WHERE id = $1',
            [data.guild_id]
        );

        embed.setTitle(`${EMOJIS.SYSTEM.GUILD} Tokens Burned`)
            .setDescription(`**${player_discord_username.rows[0]?.discord_username || data.player_id}** [${player_guild_tag.rows[0]?.tag || 'N/A'}] burned tokens`)
            .addFields(
                { name: 'Amount', value: await formatUnit(data.amount_p, data.denom), inline: true }
            );
    }

    return embed;
}

/**
 * Create embed for planet events
 */
async function createPlanetEmbed(data) {
    const planet_player_discord_details = await query(
        `SELECT 
            discord_username, 
            player.id as player_id, 
            guild_meta.tag as guild_tag 
        FROM 
            structs.player     
            LEFT JOIN structs.player_discord ON player_discord.player_id=player.id
            LEFT JOIN structs.guild_meta ON guild_meta.id=player.guild_id 
        WHERE player.planet_id = $1`,
        [data.planet_id]
    );

    const embed = new EmbedBuilder()
        .setColor(getEventColor('planet'))
        .setTimestamp(data.time ? new Date(data.time) : new Date());

    if (data.category === 'raid_status') {
        embed.setTitle(`${EMOJIS.SYSTEM.RAID} Raid Status Update`)
            .setDescription(`Planet ${data.planet_id}`)
            .addFields(
                { name: 'Status', value: data.detail?.status || 'N/A', inline: true },
                { name: 'Block', value: data.detail?.block?.toString() || 'N/A', inline: true }
            );
    } else if (data.category === 'fleet_arrive') {
        const fleet_details = await query(
            `SELECT 
                player_discord.discord_username as discord_username, 
                fleet.owner as player_id, 
                guild_meta.tag as guild_tag
            FROM 
                structs.fleet
                LEFT JOIN structs.player_discord ON player_discord.player_id=fleet.owner   
                LEFT JOIN structs.player ON player.id=fleet.owner 
                LEFT JOIN structs.guild_meta ON guild_meta.id=player.guild_id 
            WHERE 
                fleet.id = $1`,
            [data.detail?.fleet_id]
        );

        embed.setTitle(`${EMOJIS.STRUCT.FLEET} Fleet Arrived`)
            .setDescription(`Planet ${data.planet_id}`)
            .addFields(
                { name: 'Fleet ID', value: data.detail?.fleet_id || 'N/A', inline: true },
                { name: 'Owner', value: fleet_details.rows[0]?.discord_username || data.detail?.fleet_id || 'N/A', inline: true },
                { name: 'Guild', value: fleet_details.rows[0]?.guild_tag || 'N/A', inline: true }
            );
    } else if (data.category === 'fleet_advance') {
        embed.setTitle(`${EMOJIS.STRUCT.FLEET} Fleet Advanced`)
            .setDescription(`Planet ${data.planet_id}`)
            .addFields(
                { name: 'Fleet ID', value: data.detail?.fleet_id || 'N/A', inline: true },
                { name: 'Block', value: data.detail?.block?.toString() || 'N/A', inline: true }
            );
    } else if (data.category === 'fleet_depart') {
        embed.setTitle(`${EMOJIS.STRUCT.FLEET} Fleet Departed`)
            .setDescription(`Planet ${data.planet_id}`)
            .addFields(
                { name: 'Fleet ID', value: data.detail?.fleet_id || 'N/A', inline: true },
                { name: 'Destination', value: data.detail?.destination || 'N/A', inline: true }
            );
    } else if (data.category === 'struct_attack') {
        const attacker_details = await query(
            `SELECT 
                player_discord.discord_username as discord_username, 
                struct.owner as player_id, 
                guild_meta.tag as guild_tag,
                struct_type.type as type
            FROM 
                structs.struct
                LEFT JOIN structs.struct_type ON struct_type.id=struct.type
                LEFT JOIN structs.player_discord ON player_discord.player_id=struct.owner   
                LEFT JOIN structs.player ON player.id=struct.owner 
                LEFT JOIN structs.guild_meta ON guild_meta.id=player.guild_id 
            WHERE 
                struct.id = $1`,
            [data.detail?.attacker_struct_id]
        );

        const defender_details = await query(
            `SELECT 
                player_discord.discord_username as discord_username, 
                struct.owner as player_id, 
                guild_meta.tag as guild_tag,
                struct_type.type as type
            FROM 
                structs.struct
                LEFT JOIN structs.struct_type ON struct_type.id=struct.type
                LEFT JOIN structs.player_discord ON player_discord.player_id=struct.owner   
                LEFT JOIN structs.player ON player.id=struct.owner 
                LEFT JOIN structs.guild_meta ON guild_meta.id=player.guild_id 
            WHERE 
                struct.id = $1`,
            [data.detail?.defender_struct_id]
        );

        embed.setTitle(`${EMOJIS.STATUS.WARNING} Struct Attack`)
            .setDescription(`Planet ${data.planet_id}`)
            .addFields(
                { name: 'Attacker', value: `${attacker_details.rows[0]?.discord_username || 'N/A'} [${attacker_details.rows[0]?.guild_tag || 'N/A'}]`, inline: false },
                { name: 'Attacker Struct', value: `${data.detail?.attacker_struct_id} (${attacker_details.rows[0]?.type || 'N/A'})`, inline: true },
                { name: 'Defender', value: `${defender_details.rows[0]?.discord_username || 'N/A'} [${defender_details.rows[0]?.guild_tag || 'N/A'}]`, inline: false },
                { name: 'Defender Struct', value: `${data.detail?.defender_struct_id} (${defender_details.rows[0]?.type || 'N/A'})`, inline: true },
                { name: 'Damage', value: data.detail?.damage?.toString() || 'N/A', inline: true }
            );
    } else if (data.category === 'struct_defense_remove') {
        embed.setTitle(`${EMOJIS.STATUS.INFO} Defense Removed`)
            .setDescription(`Planet ${data.planet_id}`)
            .addFields(
                { name: 'Defender Struct', value: data.detail?.defender_struct_id || 'N/A', inline: true },
                { name: 'Protected Struct', value: data.detail?.protected_struct_id || 'N/A', inline: true }
            );
    } else if (data.category === 'struct_defense_add') {
        embed.setTitle(`${EMOJIS.STATUS.SUCCESS} Defense Added`)
            .setDescription(`Planet ${data.planet_id}`)
            .addFields(
                { name: 'Defender Struct', value: data.detail?.defender_struct_id || 'N/A', inline: true },
                { name: 'Protected Struct', value: data.detail?.protected_struct_id || 'N/A', inline: true }
            );
    } else if (data.category === 'struct_status') {
        const struct_player_discord_details = await query(
            `SELECT 
                player_discord.discord_username as discord_username, 
                struct.owner as player_id, 
                guild_meta.tag as guild_tag,
                upper(struct.location_type) as location_type,
                upper(struct.operating_ambit) as operating_ambit,
                struct_type.type as type,
                upper(replace(replace(struct_type.type,' ','_'),'-','_')) as emoji_type
            FROM 
                structs.struct
                LEFT JOIN structs.struct_type ON struct_type.id=struct.type
                LEFT JOIN structs.player_discord ON player_discord.player_id=struct.owner   
                LEFT JOIN structs.player ON player.id=struct.owner 
                LEFT JOIN structs.guild_meta ON guild_meta.id=player.guild_id 
            WHERE 
                struct.id = $1`,
            [data.detail.struct_id]
        );

        let participants;
        if (struct_player_discord_details.rows[0]?.player_id === planet_player_discord_details.rows[0]?.player_id) {
            participants = `${struct_player_discord_details.rows[0]?.discord_username || struct_player_discord_details.rows[0]?.player_id}[${struct_player_discord_details.rows[0]?.guild_tag}]`;
        } else {
            participants = `${planet_player_discord_details.rows[0]?.discord_username || planet_player_discord_details.rows[0]?.player_id}[${planet_player_discord_details.rows[0]?.guild_tag}]${EMOJIS.SYSTEM.RAID}${struct_player_discord_details.rows[0]?.discord_username || struct_player_discord_details.rows[0]?.player_id}[${struct_player_discord_details.rows[0]?.guild_tag}]`;
        }

        embed.setTitle(`${EMOJIS.SYSTEM.PLANET} Struct Status Update`)
            .setDescription(`${participants} - Struct ${data.detail.struct_id} on ${data.planet_id}`)
            .addFields(
                { name: 'Struct Type', value: struct_player_discord_details.rows[0]?.type || 'N/A', inline: true },
                { name: 'Location', value: formatStructType(struct_player_discord_details.rows[0]?.location_type), inline: true },
                { name: 'Ambit', value: formatOperatingAmbit(struct_player_discord_details.rows[0]?.operating_ambit), inline: true },
                { name: 'Status', value: formatStructStatus(data.detail.status), inline: false }
            );
    } else if (data.category === 'struct_move') {
        embed.setTitle(`${EMOJIS.SYSTEM.PLANET} Struct Moved`)
            .setDescription(`Planet ${data.planet_id}`)
            .addFields(
                { name: 'Struct ID', value: data.detail?.struct_id || 'N/A', inline: true },
                { name: 'From', value: data.detail?.from || 'N/A', inline: true },
                { name: 'To', value: data.detail?.to || 'N/A', inline: true }
            );
    } else if (data.category === 'struct_block_build_start') {
        const struct_player_discord_details = await query(
            `SELECT 
                player_discord.discord_username as discord_username, 
                struct.owner as player_id, 
                guild_meta.tag as guild_tag,
                upper(struct.location_type) as location_type,
                upper(struct.operating_ambit) as operating_ambit,
                struct_type.type as type,
                upper(replace(replace(struct_type.type,' ','_'),'-','_')) as emoji_type
            FROM 
                structs.struct
                LEFT JOIN structs.struct_type ON struct_type.id=struct.type
                LEFT JOIN structs.player_discord ON player_discord.player_id=struct.owner   
                LEFT JOIN structs.player ON player.id=struct.owner 
                LEFT JOIN structs.guild_meta ON guild_meta.id=player.guild_id 
            WHERE 
                struct.id = $1`,
            [data.detail.struct_id]
        );

        let participants;
        if (struct_player_discord_details.rows[0]?.player_id === planet_player_discord_details.rows[0]?.player_id) {
            participants = `${struct_player_discord_details.rows[0]?.discord_username || struct_player_discord_details.rows[0]?.player_id}[${struct_player_discord_details.rows[0]?.guild_tag}]`;
        } else {
            participants = `${planet_player_discord_details.rows[0]?.discord_username || planet_player_discord_details.rows[0]?.player_id}[${planet_player_discord_details.rows[0]?.guild_tag}]${EMOJIS.SYSTEM.RAID}${struct_player_discord_details.rows[0]?.discord_username || struct_player_discord_details.rows[0]?.player_id}[${struct_player_discord_details.rows[0]?.guild_tag}]`;
        }

        embed.setTitle(`${EMOJIS.SYSTEM.PLANET} Struct Build Initiated`)
            .setDescription(`${participants} - Planet ${data.planet_id || 'N/A'}`)
            .addFields(
                { name: 'Struct ID', value: data.detail.struct_id || 'N/A', inline: true },
                { name: 'Struct Type', value: struct_player_discord_details.rows[0]?.type || 'N/A', inline: true },
                { name: 'Location', value: formatStructType(struct_player_discord_details.rows[0]?.location_type), inline: true },
                { name: 'Ambit', value: formatOperatingAmbit(struct_player_discord_details.rows[0]?.operating_ambit), inline: true },
                { name: 'Start Block', value: data.detail.block?.toString() || 'N/A', inline: true }
            );
    } else if (data.category === 'struct_block_ore_mine_start') {
        const struct_player_discord_details = await query(
            `SELECT 
                player_discord.discord_username as discord_username, 
                struct.owner as player_id, 
                guild_meta.tag as guild_tag,
                upper(struct.location_type) as location_type,
                upper(struct.operating_ambit) as operating_ambit,
                struct_type.type as type,
                upper(replace(replace(struct_type.type,' ','_'),'-','_')) as emoji_type
            FROM 
                structs.struct
                LEFT JOIN structs.struct_type ON struct_type.id=struct.type
                LEFT JOIN structs.player_discord ON player_discord.player_id=struct.owner   
                LEFT JOIN structs.player ON player.id=struct.owner 
                LEFT JOIN structs.guild_meta ON guild_meta.id=player.guild_id 
            WHERE 
                struct.id = $1`,
            [data.detail.struct_id]
        );

        let participants;
        if (struct_player_discord_details.rows[0]?.player_id === planet_player_discord_details.rows[0]?.player_id) {
            participants = `${struct_player_discord_details.rows[0]?.discord_username || struct_player_discord_details.rows[0]?.player_id}[${struct_player_discord_details.rows[0]?.guild_tag}]`;
        } else {
            participants = `${planet_player_discord_details.rows[0]?.discord_username || planet_player_discord_details.rows[0]?.player_id}[${planet_player_discord_details.rows[0]?.guild_tag}]${EMOJIS.SYSTEM.RAID}${struct_player_discord_details.rows[0]?.discord_username || struct_player_discord_details.rows[0]?.player_id}[${struct_player_discord_details.rows[0]?.guild_tag}]`;
        }

        embed.setTitle(`${EMOJIS.CURRENCY.ORE} Mining Initiated`)
            .setDescription(`${participants} - Planet ${data.planet_id || 'N/A'}`)
            .addFields(
                { name: 'Struct ID', value: data.detail.struct_id || 'N/A', inline: true },
                { name: 'Struct Type', value: struct_player_discord_details.rows[0]?.type || 'N/A', inline: true },
                { name: 'Ambit', value: formatOperatingAmbit(struct_player_discord_details.rows[0]?.operating_ambit), inline: true },
                { name: 'Start Block', value: data.detail.block?.toString() || 'N/A', inline: true }
            );
    } else if (data.category === 'struct_block_ore_refine_start') {
        const struct_player_discord_details = await query(
            `SELECT 
                player_discord.discord_username as discord_username, 
                struct.owner as player_id, 
                guild_meta.tag as guild_tag,
                upper(struct.location_type) as location_type,
                upper(struct.operating_ambit) as operating_ambit,
                struct_type.type as type,
                upper(replace(replace(struct_type.type,' ','_'),'-','_')) as emoji_type
            FROM 
                structs.struct
                LEFT JOIN structs.struct_type ON struct_type.id=struct.type
                LEFT JOIN structs.player_discord ON player_discord.player_id=struct.owner   
                LEFT JOIN structs.player ON player.id=struct.owner 
                LEFT JOIN structs.guild_meta ON guild_meta.id=player.guild_id 
            WHERE 
                struct.id = $1`,
            [data.detail.struct_id]
        );

        let participants;
        if (struct_player_discord_details.rows[0]?.player_id === planet_player_discord_details.rows[0]?.player_id) {
            participants = `${struct_player_discord_details.rows[0]?.discord_username || struct_player_discord_details.rows[0]?.player_id}[${struct_player_discord_details.rows[0]?.guild_tag}]`;
        } else {
            participants = `${planet_player_discord_details.rows[0]?.discord_username || planet_player_discord_details.rows[0]?.player_id}[${planet_player_discord_details.rows[0]?.guild_tag}]${EMOJIS.SYSTEM.RAID}${struct_player_discord_details.rows[0]?.discord_username || struct_player_discord_details.rows[0]?.player_id}[${struct_player_discord_details.rows[0]?.guild_tag}]`;
        }

        embed.setTitle(`${EMOJIS.CURRENCY.ALPHA} Refining Initiated`)
            .setDescription(`${participants} - Planet ${data.planet_id || 'N/A'}`)
            .addFields(
                { name: 'Struct ID', value: data.detail.struct_id || 'N/A', inline: true },
                { name: 'Struct Type', value: struct_player_discord_details.rows[0]?.type || 'N/A', inline: true },
                { name: 'Ambit', value: formatOperatingAmbit(struct_player_discord_details.rows[0]?.operating_ambit), inline: true },
                { name: 'Start Block', value: data.detail.block?.toString() || 'N/A', inline: true }
            );
    } else {
        embed.setTitle(`${EMOJIS.SYSTEM.PLANET} Planet Update`)
            .setDescription(`Planet ${data.planet_id || 'N/A'}`)
            .addFields(
                { name: 'Category', value: data.category || 'N/A', inline: true }
            );

        if (data.detail && !data.stub) {
            Object.entries(data.detail).forEach(([key, value]) => {
                embed.addFields({ name: key, value: typeof value === 'object' ? JSON.stringify(value) : value.toString(), inline: true });
            });
        }
    }

    return embed;
}

/**
 * Create embed for player events
 */
async function createPlayerEmbed(data) {
    const embed = new EmbedBuilder()
        .setColor(getEventColor('player'))
        .setTimestamp(data.time ? new Date(data.time) : new Date());

    if (data.category === 'player_consensus') {
        const discord_username = await query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [data.id]
        );

        const guild_details = await query(
            'SELECT tag FROM structs.guild_meta WHERE id = $1',
            [data.guild_id]
        );

        embed.setTitle(`${EMOJIS.SYSTEM.MEMBER_DIRECTORY} Player Consensus Update`)
            .setDescription(`${discord_username.rows[0]?.discord_username || data.id}[${guild_details.rows[0]?.tag || 'N/A'}]`)
            .addFields(
                { name: 'Player ID', value: data.id || 'N/A', inline: true },
                { name: 'Substation', value: data.substation_id || 'N/A', inline: true },
                { name: 'Planet', value: data.planet_id || 'N/A', inline: true },
                { name: 'Fleet', value: data.fleet_id || 'N/A', inline: true }
            );
    } else if (data.category === 'player_meta') {
        embed.setTitle(`${EMOJIS.SYSTEM.MEMBER_DIRECTORY} Player Meta Update`)
            .setDescription(`Player ID: ${data.id || 'N/A'}`)
            .addFields(
                { name: 'Guild ID', value: data.guild_id || 'N/A', inline: true },
                { name: 'Username', value: data.username || 'N/A', inline: true },
                { name: 'Status', value: data.status || 'N/A', inline: true }
            );
    } else {
        embed.setTitle(`${EMOJIS.STATUS.INFO} Player Update`)
            .setDescription(`Player ID: ${data.player_id || data.id || 'N/A'}`)
            .addFields(
                { name: 'Attribute Type', value: data.attribute_type || 'N/A', inline: true },
                { name: 'Value', value: data.val?.toString() || 'N/A', inline: true }
            );
    }

    return embed;
}

/**
 * Create embed for provider events
 */
async function createProviderEmbed(data) {
    const embed = new EmbedBuilder()
        .setColor(getEventColor('info'))
        .setTitle(`${EMOJIS.STATUS.INFO} Provider Update`)
        .setDescription(`Provider ID: ${data.id || 'N/A'}`)
        .addFields(
            { name: 'Substation ID', value: data.substation_id || 'N/A', inline: true },
            { name: 'Rate', value: `${data.rate_amount?.toString() || 'N/A'} ${data.rate_denom || ''}`, inline: true },
            { name: 'Access Policy', value: data.access_policy || 'N/A', inline: true },
            { name: 'Capacity Min', value: data.capacity_minimum?.toString() || 'N/A', inline: true },
            { name: 'Capacity Max', value: data.capacity_maximum?.toString() || 'N/A', inline: true },
            { name: 'Duration Min', value: data.duration_minimum?.toString() || 'N/A', inline: true },
            { name: 'Duration Max', value: data.duration_maximum?.toString() || 'N/A', inline: true },
            { name: 'Owner', value: data.owner || 'N/A', inline: true }
        )
        .setTimestamp(data.time ? new Date(data.time) : new Date());

    return embed;
}

/**
 * Create embed for consensus block events
 */
function createConsensusBlockEmbed(data) {
    return new EmbedBuilder()
        .setColor(getEventColor('info'))
        .setTitle(`${EMOJIS.STATUS.INFO} Block Update`)
        .setDescription(`Block Height: ${data.height?.toString() || 'N/A'}`)
        .setTimestamp(data.time ? new Date(data.time) : new Date());
}

/**
 * Create embed for generic alert/warning/info messages
 */
function createGenericEmbed(data) {
    const embed = new EmbedBuilder()
        .setTimestamp(data.time ? new Date(data.time) : new Date());

    switch (data.category) {
        case 'alert':
            embed.setColor(0xff0000)
                .setTitle(`${EMOJIS.STATUS.ERROR} ALERT`)
                .setDescription(data.message || 'No message provided');
            break;
        case 'warning':
            embed.setColor(0xffaa00)
                .setTitle(`${EMOJIS.STATUS.WARNING} WARNING`)
                .setDescription(data.message || 'No message provided');
            break;
        case 'info':
            embed.setColor(0x0099ff)
                .setTitle(`${EMOJIS.STATUS.INFO} INFO`)
                .setDescription(data.message || 'No message provided');
            break;
        default:
            embed.setColor(0x0099ff)
                .setDescription(data.message || 'No message provided');
    }

    return embed;
}

module.exports = {
    createAgreementEmbed,
    createGridEmbed,
    createGuildEmbed,
    createInventoryEmbed,
    createPlanetEmbed,
    createPlayerEmbed,
    createProviderEmbed,
    createConsensusBlockEmbed,
    createGenericEmbed,
    getEventColor
};

