const { EmbedBuilder } = require('discord.js');
const { fetchPlayerData, fetchStructData } = require('../queries/structs');
const db = require('../database');
const { getDiscordUsername, getPlayerIdFromAddress } = require('../utils/player');
const { 
    createEnhancedEmbed, 
    createResourceField, 
    createStatusField, 
    createSeparatorField,
    createEntityCard,
    EMBED_COLORS 
} = require('../utils/embedFormatter');
const { formatNumber, formatResource, createProgressBar, createSeparator } = require('../utils/designSystem');

const createPlayerEmbed = async (player) => {
    const fields = createEntityCard(player, {
        title: `👤 ${player.username || player.discord_username || 'Unknown'}`,
        fields: [
            { key: 'player_id', label: 'Player ID', format: 'string', options: { inline: true } },
            { 
                key: 'guild_name', 
                label: 'Guild', 
                format: (value, data) => {
                    if (!value && !data.guild_id) return 'None';
                    return `${value || 'Unknown'} [${data.guild_id || 'N/A'}]`;
                },
                options: { inline: true }
            },
            { key: 'primary_address', label: 'Primary Address', format: 'string', options: { inline: false } }
        ],
        sections: [
            {
                title: '⚡ Power',
                fields: [
                    { 
                        key: 'structs_load', 
                        label: 'Structs Energy Consumption', 
                        format: 'resource',
                        type: 'energy',
                        options: { inline: false, suffix: 'W' }
                    },
                    {
                        key: 'load',
                        label: 'Available Allocation Capacity',
                        format: 'progress',
                        options: { 
                            max: (data) => parseFloat(data.capacity) || 1,
                            length: 20,
                            showPercentage: true,
                            showValues: true,
                            inline: false
                        }
                    },
                    {
                        key: 'connection_capacity',
                        label: 'Substation Provided Capacity',
                        format: 'resource',
                        type: 'capacity',
                        options: { inline: false, suffix: 'W' }
                    },
                    {
                        key: 'total_load',
                        label: 'Total Energy',
                        format: 'progress',
                        options: {
                            max: (data) => parseFloat(data.total_capacity) || 1,
                            length: 20,
                            showPercentage: true,
                            showValues: true,
                            inline: false
                        }
                    }
                ]
            }
        ]
    });

    // Add location fields
    fields.push(createSeparatorField());
    if (player.substation_id) {
        fields.push({ name: '📍 Substation ID', value: player.substation_id, inline: true });
    }
    if (player.planet_id) {
        fields.push({ name: '🌍 Planet ID', value: player.planet_id, inline: true });
    }
    if (player.fleet_id) {
        fields.push({ name: '🚀 Fleet ID', value: player.fleet_id, inline: true });
    }

    return createEnhancedEmbed({
        title: `Player: ${player.username || player.discord_username || 'Unknown'}`,
        color: EMBED_COLORS.primary,
        fields
    });
};

const createGuildEmbed = async (guild) => {
    const fields = createEntityCard(guild, {
        title: `🏰 ${guild.name || 'Unknown'}`,
        fields: [
            { key: 'id', label: 'Guild ID', format: 'string', options: { inline: true } },
            { key: 'tag', label: 'Tag', format: 'string', options: { inline: true } },
            { 
                key: 'join_infusion_minimum', 
                label: 'Join Infusion Minimum', 
                format: 'number',
                options: { inline: true }
            }
        ]
    });

    return createEnhancedEmbed({
        title: `Guild: ${guild.name || 'Unknown'}`,
        description: guild.description || undefined,
        color: EMBED_COLORS.secondary,
        thumbnail: guild.logo || undefined,
        fields,
        footer: guild.website ? `Website: ${guild.website}` : undefined
    });
};

const createPlanetEmbed = async (planet) => {
    // Get Discord username for owner if available
    let ownerDisplay = planet.owner;
    if (planet.owner) {
        const discordUsername = await getDiscordUsername(planet.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${planet.owner})`;
        } else {
            ownerDisplay = planet.owner;
        }
    }

    const fields = createEntityCard(planet, {
        title: `🌍 ${planet.planet_id}`,
        fields: [
            { key: 'planet_id', label: 'Planet ID', format: 'string', options: { inline: true } },
            { 
                key: 'owner', 
                label: 'Owner', 
                format: () => ownerDisplay || 'None',
                options: { inline: true }
            },
            { 
                key: 'status', 
                label: 'Status', 
                format: 'badge',
                type: planet.status === 'active' ? 'active' : 'info',
                options: { inline: true }
            },
            { 
                key: 'max_ore', 
                label: 'Max Ore', 
                format: 'resource',
                type: 'ore',
                options: { inline: true }
            },
            { 
                key: 'vulnerable_ore', 
                label: 'Vulnerable Ore', 
                format: 'resource',
                type: 'ore',
                options: { inline: true }
            }
        ]
    });

    // Defense Systems
    const defenseFields = [];
    if (planet.planetary_shield > 0 || planet.repair_network_quantity > 0 || 
        planet.defensive_cannon_quantity > 0 || planet.coordinated_global_shield_network_quantity > 0) {
        fields.push(createSeparatorField());
        fields.push({ name: '🛡️ Defense Systems', value: createSeparator('─', 30), inline: false });
        if (planet.planetary_shield > 0) {
            defenseFields.push({ name: 'Planetary Shield', value: formatNumber(planet.planetary_shield), inline: true });
        }
        if (planet.repair_network_quantity > 0) {
            defenseFields.push({ name: 'Repair Network', value: formatNumber(planet.repair_network_quantity), inline: true });
        }
        if (planet.defensive_cannon_quantity > 0) {
            defenseFields.push({ name: 'Defensive Cannon', value: formatNumber(planet.defensive_cannon_quantity), inline: true });
        }
        if (planet.coordinated_global_shield_network_quantity > 0) {
            defenseFields.push({ name: 'Global Shield Network', value: formatNumber(planet.coordinated_global_shield_network_quantity), inline: true });
        }
        fields.push(...defenseFields);
    }

    // Interceptor Networks
    if (planet.low_orbit_ballistics_interceptor_network_quantity > 0 || 
        planet.advanced_low_orbit_ballistics_interceptor_network_quantity > 0) {
        fields.push(createSeparatorField());
        fields.push({ name: '🚀 Interceptor Networks', value: createSeparator('─', 30), inline: false });
        if (planet.low_orbit_ballistics_interceptor_network_quantity > 0) {
            fields.push({ name: 'LOBI Network', value: formatNumber(planet.low_orbit_ballistics_interceptor_network_quantity), inline: true });
        }
        if (planet.advanced_low_orbit_ballistics_interceptor_network_quantity > 0) {
            fields.push({ name: 'Advanced LOBI Network', value: formatNumber(planet.advanced_low_orbit_ballistics_interceptor_network_quantity), inline: true });
        }
    }

    // LOBI Success Rate
    if (planet.lobi_network_success_rate_denominator > 0) {
        const successRate = (planet.lobi_network_success_rate_numerator / planet.lobi_network_success_rate_denominator * 100).toFixed(2);
        fields.push({ name: 'LOBI Success Rate', value: `${successRate}%`, inline: true });
    }

    // Jamming Stations
    if (planet.orbital_jamming_station_quantity > 0 || planet.advanced_orbital_jamming_station_quantity > 0) {
        fields.push(createSeparatorField());
        fields.push({ name: '📡 Jamming Stations', value: createSeparator('─', 30), inline: false });
        if (planet.orbital_jamming_station_quantity > 0) {
            fields.push({ name: 'Orbital Jamming', value: formatNumber(planet.orbital_jamming_station_quantity), inline: true });
        }
        if (planet.advanced_orbital_jamming_station_quantity > 0) {
            fields.push({ name: 'Advanced Jamming', value: formatNumber(planet.advanced_orbital_jamming_station_quantity), inline: true });
        }
    }

    // Raid Protection
    if (planet.block_start_raid > 0) {
        fields.push(createSeparatorField());
        fields.push({ name: '🛡️ Raid Protection', value: `Active since block ${formatNumber(planet.block_start_raid)}`, inline: false });
    }

    return createEnhancedEmbed({
        title: `Planet: ${planet.planet_id}`,
        color: EMBED_COLORS.primary,
        fields
    });
};

const createStructEmbed = async (struct) => {
    // Get Discord username for owner if available
    let ownerDisplay = struct.owner;
    if (struct.owner) {
        const discordUsername = await getDiscordUsername(struct.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${struct.owner})`;
        } else {
            ownerDisplay = struct.owner;
        }
    }

    const statusFlags = [];
    if (struct.status?.materialized) statusFlags.push('✅ Materialized');
    if (struct.status?.built) statusFlags.push('✅ Built');
    if (struct.status?.online) statusFlags.push('🟢 Online');
    if (struct.status?.stored) statusFlags.push('📦 Stored');
    if (struct.status?.hidden) statusFlags.push('👁️ Hidden');
    if (struct.status?.destroyed) statusFlags.push('💥 Destroyed');
    if (struct.status?.locked) statusFlags.push('🔒 Locked');

    const fields = createEntityCard(struct, {
        title: `🏗️ ${struct.struct_id}`,
        fields: [
            { key: 'struct_id', label: 'Struct ID', format: 'string', options: { inline: true } },
            { 
                key: 'owner', 
                label: 'Owner', 
                format: () => ownerDisplay || 'None',
                options: { inline: true }
            },
            { key: 'type', label: 'Type', format: 'string', options: { inline: true } },
            { key: 'category', label: 'Category', format: 'string', options: { inline: true } },
            { 
                key: 'location_type', 
                label: 'Location', 
                format: (value, data) => `${value} ${data.location_id}`,
                options: { inline: true }
            },
            { key: 'slot', label: 'Slot', format: 'number', options: { inline: true } },
            {
                key: 'health',
                label: 'Health',
                format: 'progress',
                options: {
                    max: (data) => parseFloat(data.max_health) || 1,
                    length: 20,
                    showPercentage: true,
                    showValues: true,
                    inline: true
                }
            },
            {
                key: 'status',
                label: 'Status',
                format: () => statusFlags.length > 0 ? statusFlags.join(' | ') : 'None',
                options: { inline: false }
            }
        ]
    });

    // Build Status
    if (!struct.status?.built) {
        fields.push(createSeparatorField());
        fields.push({ name: '🏗️ Build Status', value: createSeparator('─', 30), inline: false });
        fields.push({ name: 'Build Start', value: formatNumber(struct.block_start_build), inline: true });
        fields.push({ name: 'Build Difficulty', value: formatNumber(struct.build_difficulty), inline: true });
    }

    // Mining Status
    if (struct.planetary_mining !== 'noPlanetaryMining') {
        fields.push(createSeparatorField());
        fields.push({ name: '⛏️ Mining', value: `Started: Block ${formatNumber(struct.block_start_ore_mine)}`, inline: false });
    }

    // Refining Status
    if (struct.planetary_refinery !== 'noPlanetaryRefinery') {
        fields.push(createSeparatorField());
        fields.push({ name: '🔧 Refining', value: `Started: Block ${formatNumber(struct.block_start_ore_refine)}`, inline: false });
    }

    // Power Generation
    if (struct.power_generation !== 'noPowerGeneration') {
        fields.push(createSeparatorField());
        fields.push({ name: '⚡ Power Generation', value: createSeparator('─', 30), inline: false });
        fields.push({ name: 'Fuel', value: formatResource('fuel', struct.generator_fuel || 0), inline: true });
        fields.push({ name: 'Load', value: formatResource('load', struct.generator_load || 0), inline: true });
        fields.push({ name: 'Capacity', value: formatResource('capacity', struct.generator_capacity || 0), inline: true });
    }

    // Weapons
    if (struct.primary_weapon || struct.secondary_weapon) {
        fields.push(createSeparatorField());
        fields.push({ name: '⚔️ Weapons', value: createSeparator('─', 30), inline: false });
        if (struct.primary_weapon) {
            fields.push({ name: 'Primary', value: struct.primary_weapon, inline: true });
        }
        if (struct.secondary_weapon) {
            fields.push({ name: 'Secondary', value: struct.secondary_weapon, inline: true });
        }
    }

    return createEnhancedEmbed({
        title: `Struct: ${struct.struct_id}`,
        color: EMBED_COLORS.primary,
        fields
    });
};

const createFleetEmbed = async (fleet) => {
    // Get Discord username for owner if available
    let ownerDisplay = fleet.owner;
    if (fleet.owner) {
        const discordUsername = await getDiscordUsername(fleet.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${fleet.owner})`;
        } else {
            ownerDisplay = fleet.owner;
        }
    }

    const fields = createEntityCard(fleet, {
        title: `🚀 ${fleet.name || 'Unknown'}`,
        fields: [
            { key: 'id', label: 'Fleet ID', format: 'string', options: { inline: true } },
            { key: 'fleet_type_name', label: 'Type', format: 'string', options: { inline: true } },
            { 
                key: 'owner', 
                label: 'Owner', 
                format: () => ownerDisplay || 'None',
                options: { inline: true }
            }
        ]
    });

    return createEnhancedEmbed({
        title: `Fleet: ${fleet.name || 'Unknown'}`,
        color: EMBED_COLORS.primary,
        fields
    });
};

const createProviderEmbed = async (provider) => {
    // Get Discord username for owner if available
    let ownerDisplay = provider.owner;
    if (provider.owner) {
        const discordUsername = await getDiscordUsername(provider.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${provider.owner})`;
        } else {
            ownerDisplay = provider.owner;
        }
    }

    const fields = createEntityCard(provider, {
        title: `💰 ${provider.id}`,
        fields: [
            { key: 'id', label: 'Provider ID', format: 'string', options: { inline: true } },
            { 
                key: 'owner', 
                label: 'Owner', 
                format: () => ownerDisplay || 'None',
                options: { inline: true }
            },
            { key: 'substation_id', label: 'Substation ID', format: 'string', options: { inline: true } },
            { key: 'rate', label: 'Rate', format: 'number', options: { inline: true } },
            { key: 'access_policy', label: 'Access Policy', format: 'badge', type: 'info', options: { inline: true } }
        ],
        sections: [
            {
                title: '📊 Capacity & Duration',
                fields: [
                    { 
                        key: 'capacity_minimum', 
                        label: 'Capacity Range', 
                        format: (value, data) => `${formatNumber(value)} - ${formatNumber(data.capacity_maximum)}`,
                        options: { inline: true }
                    },
                    { 
                        key: 'duration_minimum', 
                        label: 'Duration Range', 
                        format: (value, data) => `${formatNumber(value)} - ${formatNumber(data.duration_maximum)} blocks`,
                        options: { inline: true }
                    },
                    { 
                        key: 'provider_cancellation_pentalty', 
                        label: 'Provider Penalty', 
                        format: 'number',
                        options: { inline: true }
                    },
                    { 
                        key: 'consumer_cacellation_pentalty', 
                        label: 'Consumer Penalty', 
                        format: 'number',
                        options: { inline: true }
                    }
                ]
            }
        ]
    });

    return createEnhancedEmbed({
        title: `Provider: ${provider.id}`,
        color: EMBED_COLORS.secondary,
        fields
    });
};

const createAllocationEmbed = async (allocation) => {
    // Get Discord username for controller if available
    let controllerDisplay = allocation.controller;
    if (allocation.controller) {
        const playerId = await getPlayerIdFromAddress(allocation.controller);
        const discordUsername = await getDiscordUsername(playerId);
        if (discordUsername) {
            controllerDisplay = `${discordUsername} (${allocation.controller})`;
        } else {
            controllerDisplay = allocation.controller;
        }
    }

    const fields = createEntityCard(allocation, {
        title: `📡 ${allocation.id}`,
        fields: [
            { key: 'id', label: 'Allocation ID', format: 'string', options: { inline: true } },
            { key: 'allocation_type', label: 'Type', format: 'string', options: { inline: true } },
            { key: 'source_id', label: 'Source ID', format: 'string', options: { inline: true } },
            { key: 'destination_id', label: 'Destination ID', format: 'string', options: { inline: true } },
            { 
                key: 'controller', 
                label: 'Controller', 
                format: () => controllerDisplay || 'None',
                options: { inline: true }
            },
            { 
                key: 'capacity', 
                label: 'Capacity', 
                format: 'resource',
                type: 'capacity',
                options: { inline: true, suffix: 'W' }
            }
        ]
    });

    return createEnhancedEmbed({
        title: `Allocation: ${allocation.id}`,
        color: EMBED_COLORS.primary,
        fields
    });
};

const createAgreementEmbed = async (agreement) => {
    // Get Discord username for owner if available
    let ownerDisplay = agreement.owner;
    if (agreement.owner) {
        const discordUsername = await getDiscordUsername(agreement.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${agreement.owner})`;
        } else {
            ownerDisplay = agreement.owner;
        }
    }

    const fields = createEntityCard(agreement, {
        title: `🤝 ${agreement.id}`,
        fields: [
            { key: 'id', label: 'Agreement ID', format: 'string', options: { inline: true } },
            { key: 'provider_id', label: 'Provider ID', format: 'string', options: { inline: true } },
            { key: 'allocation_id', label: 'Allocation ID', format: 'string', options: { inline: true } },
            { 
                key: 'capacity', 
                label: 'Capacity', 
                format: 'resource',
                type: 'capacity',
                options: { inline: true, suffix: 'W' }
            },
            { key: 'duration', label: 'Duration', format: (value) => `${formatNumber(value)} blocks`, options: { inline: true } },
            { key: 'end_block', label: 'End Block', format: 'number', options: { inline: true } },
            { 
                key: 'owner', 
                label: 'Owner', 
                format: () => ownerDisplay || 'None',
                options: { inline: true }
            }
        ]
    });

    return createEnhancedEmbed({
        title: `Agreement: ${agreement.id}`,
        color: EMBED_COLORS.secondary,
        fields
    });
};

const createSubstationEmbed = async (substation) => {
    // Get Discord username for owner if available
    let ownerDisplay = substation.owner;
    if (substation.owner) {
        const discordUsername = await getDiscordUsername(substation.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${substation.owner})`;
        } else {
            ownerDisplay = substation.owner;
        }
    }

    const fields = createEntityCard(substation, {
        title: `⚡ ${substation.substation_id}`,
        fields: [
            { key: 'substation_id', label: 'Substation ID', format: 'string', options: { inline: true } },
            { 
                key: 'owner', 
                label: 'Owner', 
                format: () => ownerDisplay || 'None',
                options: { inline: true }
            }
        ],
        sections: [
            {
                title: '📊 Capacity & Load',
                fields: [
                    {
                        key: 'load',
                        label: 'Load',
                        format: 'progress',
                        options: {
                            max: (data) => parseFloat(data.capacity) || 1,
                            length: 20,
                            showPercentage: true,
                            showValues: true,
                            inline: true
                        }
                    },
                    {
                        key: 'capacity',
                        label: 'Capacity',
                        format: 'resource',
                        type: 'capacity',
                        options: { inline: true, suffix: 'W' }
                    },
                    {
                        key: 'connection_capacity',
                        label: 'Connection Capacity',
                        format: 'resource',
                        type: 'capacity',
                        options: { inline: true, suffix: 'W' }
                    },
                    {
                        key: 'connection_count',
                        label: 'Connection Count',
                        format: 'number',
                        options: { inline: true }
                    }
                ]
            }
        ]
    });

    return createEnhancedEmbed({
        title: `Substation: ${substation.substation_id}`,
        color: EMBED_COLORS.primary,
        fields
    });
};

const createReactorEmbed = async (reactor) => {
    const fields = createEntityCard(reactor, {
        title: `🔋 ${reactor.reactor_id}`,
        fields: [
            { key: 'reactor_id', label: 'Reactor ID', format: 'string', options: { inline: true } },
            { 
                key: 'status', 
                label: 'Status', 
                format: 'badge',
                type: reactor.status === 'active' ? 'active' : 'inactive',
                options: { inline: false }
            }
        ],
        sections: [
            {
                title: '⛽ Fuel & Power',
                fields: [
                    {
                        key: 'fuel',
                        label: 'Fuel',
                        format: 'resource',
                        type: 'fuel',
                        options: { inline: true }
                    },
                    {
                        key: 'load',
                        label: 'Load',
                        format: 'progress',
                        options: {
                            max: (data) => parseFloat(data.capacity) || 1,
                            length: 20,
                            showPercentage: true,
                            showValues: true,
                            inline: true
                        }
                    },
                    {
                        key: 'capacity',
                        label: 'Capacity',
                        format: 'resource',
                        type: 'power',
                        options: { inline: true, suffix: 'W' }
                    }
                ]
            }
        ]
    });

    return createEnhancedEmbed({
        title: `Reactor: ${reactor.reactor_id}`,
        color: EMBED_COLORS.primary,
        fields
    });
};

const createEmbeds = {
    async player(player) {
        const embeds = [await createPlayerEmbed(player)];
        return embeds;
    },

    async guild(guild) {
        const embeds = [await createGuildEmbed(guild)];
        return embeds;
    },

    async planet(planet) {
        const embeds = [await createPlanetEmbed(planet)];
        if (planet.owner) {
            const ownerData = await fetchPlayerData.byId(planet.owner);
            if (ownerData.rows.length > 0) {
                embeds.push(...await createEmbeds.player(ownerData.rows[0]));
            }
        }
        return embeds;
    },

    async struct(struct) {
        const embeds = [await createStructEmbed(struct)];
        if (struct.owner) {
            const ownerData = await fetchPlayerData.byId(struct.owner);
            if (ownerData.rows.length > 0) {
                embeds.push(...await createEmbeds.player(ownerData.rows[0]));
            }
        }
        return embeds;
    },

    async fleet(fleet) {
        const embeds = [await createFleetEmbed(fleet)];
        if (fleet.owner) {
            const ownerData = await fetchPlayerData.byId(fleet.owner);
            if (ownerData.rows.length > 0) {
                embeds.push(...await createEmbeds.player(ownerData.rows[0]));
            }
        }
        return embeds;
    },

    async provider(provider) {
        const embeds = [await createProviderEmbed(provider)];
        if (provider.owner) {
            const ownerData = await fetchPlayerData.byId(provider.owner);
            if (ownerData.rows.length > 0) {
                embeds.push(...await createEmbeds.player(ownerData.rows[0]));
            }
        }
        return embeds;
    },

    async allocation(allocation) {
        const embeds = [await createAllocationEmbed(allocation)];
        if (allocation.controller) {
            const controllerData = await fetchPlayerData.byId(allocation.controller);
            if (controllerData.rows.length > 0) {
                embeds.push(...await createEmbeds.player(controllerData.rows[0]));
            }
        }
        return embeds;
    },

    async agreement(agreement) {
        const embeds = [await createAgreementEmbed(agreement)];
        if (agreement.owner) {
            const ownerData = await fetchPlayerData.byId(agreement.owner);
            if (ownerData.rows.length > 0) {
                embeds.push(...await createEmbeds.player(ownerData.rows[0]));
            }
        }
        if (agreement.provider_id) {
            const providerData = await fetchStructData.provider(agreement.provider_id);
            if (providerData.rows.length > 0) {
                embeds.push(...await createEmbeds.provider(providerData.rows[0]));
            }
        }
        return embeds;
    },

    async substation(substation) {
        return [await createSubstationEmbed(substation)];
    },

    async reactor(reactor) {
        return [await createReactorEmbed(reactor)];
    },

    async infusion(infusion) {
        return [await createInfusionEmbed(infusion)];
    },

    async address(address) {
        return [await createAddressEmbed(address)];
    }
};

const createInfusionEmbed = async (infusion) => {
    // Get Discord username for owner if available
    let ownerDisplay = infusion.owner;
    if (infusion.owner) {
        const discordUsername = await getDiscordUsername(infusion.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${infusion.owner})`;
        } else {
            ownerDisplay = infusion.owner;
        }
    }

    const fields = createEntityCard(infusion, {
        title: `💉 ${infusion.id}`,
        fields: [
            { key: 'id', label: 'Infusion ID', format: 'string', options: { inline: true } },
            { 
                key: 'owner', 
                label: 'Owner', 
                format: () => ownerDisplay || 'None',
                options: { inline: true }
            },
            { key: 'reactor_id', label: 'Reactor ID', format: 'string', options: { inline: true } },
            { key: 'reactor_validator', label: 'Reactor Validator', format: 'string', options: { inline: true } },
            { 
                key: 'amount', 
                label: 'Amount', 
                format: 'resource',
                type: 'alpha',
                options: { inline: true }
            },
            { key: 'denom', label: 'Denomination', format: 'string', options: { inline: true } }
        ],
        sections: [
            {
                title: '⏱️ Timeline',
                fields: [
                    { key: 'start_block', label: 'Start Block', format: 'number', options: { inline: true } },
                    { key: 'end_block', label: 'End Block', format: 'number', options: { inline: true } },
                    { key: 'duration', label: 'Duration', format: (value) => `${formatNumber(value || 0)} blocks`, options: { inline: true } }
                ]
            }
        ]
    });

    return createEnhancedEmbed({
        title: `Infusion: ${infusion.id}`,
        color: EMBED_COLORS.primary,
        fields
    });
};

const createAddressEmbed = async (address) => {
    const fields = createEntityCard(address, {
        title: `📍 ${address.address}`,
        fields: [
            { key: 'address', label: 'Address', format: 'string', options: { inline: false } },
            { key: 'player_id', label: 'Player ID', format: 'string', options: { inline: true } },
            { 
                key: 'username', 
                label: 'Username', 
                format: (value, data) => value || data.discord_username || 'Unknown',
                options: { inline: true }
            },
            { 
                key: 'guild_name', 
                label: 'Guild', 
                format: (value, data) => value ? `${value} [${data.guild_tag}]` : 'None',
                options: { inline: true }
            }
        ],
        sections: [
            {
                title: '📍 Locations',
                fields: [
                    { key: 'substation_id', label: 'Substation ID', format: 'string', options: { inline: true, showIfNull: false } },
                    { key: 'planet_id', label: 'Planet ID', format: 'string', options: { inline: true, showIfNull: false } },
                    { key: 'fleet_id', label: 'Fleet ID', format: 'string', options: { inline: true, showIfNull: false } }
                ]
            },
            {
                title: '⚡ Resources & Energy',
                fields: [
                    { 
                        key: 'ore', 
                        label: 'Ore', 
                        format: 'resource',
                        type: 'ore',
                        options: { inline: true }
                    },
                    { 
                        key: 'load', 
                        label: 'Load', 
                        format: 'resource',
                        type: 'load',
                        options: { inline: true, suffix: 'W' }
                    },
                    { 
                        key: 'structs_load', 
                        label: 'Structs Load', 
                        format: 'resource',
                        type: 'load',
                        options: { inline: true, suffix: 'W' }
                    },
                    { 
                        key: 'capacity', 
                        label: 'Capacity', 
                        format: 'resource',
                        type: 'capacity',
                        options: { inline: true, suffix: 'W' }
                    },
                    { 
                        key: 'connection_capacity', 
                        label: 'Connection Capacity', 
                        format: 'resource',
                        type: 'capacity',
                        options: { inline: true, suffix: 'W' }
                    },
                    {
                        key: 'total_load',
                        label: 'Total Load',
                        format: 'progress',
                        options: {
                            max: (data) => parseFloat(data.total_capacity) || 1,
                            length: 20,
                            showPercentage: true,
                            showValues: true,
                            inline: false
                        }
                    }
                ]
            }
        ]
    });

    if (address.primary_address && address.primary_address !== address.address) {
        fields.push(createSeparatorField());
        fields.push({ name: '🔗 Primary Address', value: address.primary_address, inline: false });
    }

    return createEnhancedEmbed({
        title: `Address: ${address.address}`,
        color: EMBED_COLORS.primary,
        fields
    });
};

module.exports = {
    createEmbeds
}; 