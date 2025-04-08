const { EmbedBuilder } = require('discord.js');
const { fetchPlayerData } = require('../queries/structs');
const db = require('../database');

// Helper function to get Discord username from player ID
const getDiscordUsername = async (playerId) => {
    try {
        const result = await db.query(
            'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
            [playerId]
        );
        if (result.rows.length > 0) {
            return result.rows[0].discord_username;
        }
        return null;
    } catch (error) {
        console.error('Error fetching Discord username:', error);
        return null;
    }
};

const createPlayerEmbed = async (player) => {
    const embed = new EmbedBuilder()
        .setTitle(`Player: ${player.username || 'Unknown'}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Player ID', value: player.player_id , inline: true },
            { name: 'Guild', value: player.guild_name + '[' + player.guild_id + ']' || 'None', inline: true },
            { name: 'Primary Address', value: player.primary_address || 'None', inline: false },
            { name: 'Ore', value: player.ore || '0', inline: false },
            { name: 'Load', value: player.load || '0', inline: true },
            { name: 'Structs Load', value: player.structs_load || '0', inline: true },
            { name: 'Capacity', value: player.capacity || '0', inline: true },
            { name: 'Connection Capacity', value: player.connection_capacity || '0', inline: true },
            { name: '\u200b', value: '\u200b'},
            { name: 'Total Load', value: player.total_load || '0', inline: true },
            { name: 'Total Capacity', value: player.total_capacity || '0', inline: true }
        );

    embed.addFields({ name: '\u200b', value: '\u200b'});

    if (player.substation_id) {
        embed.addFields({ name: 'Substation ID', value: player.substation_id, inline: true });
    }
    if (player.planet_id) {
        embed.addFields({ name: 'Planet ID', value: player.planet_id, inline: true });
    }
    if (player.fleet_id) {
        embed.addFields({ name: 'Fleet ID', value: player.fleet_id, inline: true });
    }

    return embed;
};

const createGuildEmbed = async (guild) => {
    const embed = new EmbedBuilder()
        .setTitle(`Guild: ${guild.name || 'Unknown'}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Guild ID', value: guild.id, inline: true },
            { name: 'Tag', value: guild.tag || 'None', inline: true },
            { name: 'Join Infusion Minimum', value: guild.join_infusion_minimum || '0', inline: true }
        );

    if (guild.description) {
        embed.setDescription(guild.description);
    }
    if (guild.logo) {
        embed.setThumbnail(guild.logo);
    }
    if (guild.website) {
        embed.setURL(guild.website);
    }

    return embed;
};

const createPlanetEmbed = async (planet) => {
    // Get Discord username for owner if available
    let ownerDisplay = planet.owner;
    if (planet.owner) {
        const discordUsername = await getDiscordUsername(planet.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${planet.owner})`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Planet: ${planet.planet_id}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Planet ID', value: planet.planet_id, inline: true },
            { name: 'Owner', value: ownerDisplay || 'None', inline: true },
            { name: 'Status', value: planet.status || 'Unknown', inline: true },
            { name: 'Max Ore', value: planet.max_ore || '0', inline: true },
            { name: 'Vulnerable Ore', value: planet.vulnerable_ore || '0', inline: true }
        );

    // Defense Systems
    if (planet.planetary_shield > 0 || planet.repair_network_quantity > 0 || 
        planet.defensive_cannon_quantity > 0 || planet.coordinated_global_shield_network_quantity > 0) {
        embed.addFields({ name: 'Defense Systems', value: '\u200B' });
        if (planet.planetary_shield > 0) {
            embed.addFields({ name: 'Planetary Shield', value: planet.planetary_shield.toString(), inline: true });
        }
        if (planet.repair_network_quantity > 0) {
            embed.addFields({ name: 'Repair Network', value: planet.repair_network_quantity.toString(), inline: true });
        }
        if (planet.defensive_cannon_quantity > 0) {
            embed.addFields({ name: 'Defensive Cannon', value: planet.defensive_cannon_quantity.toString(), inline: true });
        }
        if (planet.coordinated_global_shield_network_quantity > 0) {
            embed.addFields({ name: 'Global Shield Network', value: planet.coordinated_global_shield_network_quantity.toString(), inline: true });
        }
    }

    // Interceptor Networks
    if (planet.low_orbit_ballistics_interceptor_network_quantity > 0 || 
        planet.advanced_low_orbit_ballistics_interceptor_network_quantity > 0) {
        embed.addFields({ name: 'Interceptor Networks', value: '\u200B' });
        if (planet.low_orbit_ballistics_interceptor_network_quantity > 0) {
            embed.addFields({ name: 'LOBI Network', value: planet.low_orbit_ballistics_interceptor_network_quantity.toString(), inline: true });
        }
        if (planet.advanced_low_orbit_ballistics_interceptor_network_quantity > 0) {
            embed.addFields({ name: 'Advanced LOBI Network', value: planet.advanced_low_orbit_ballistics_interceptor_network_quantity.toString(), inline: true });
        }
    }

    // LOBI Success Rate
    if (planet.lobi_network_success_rate_denominator > 0) {
        const successRate = (planet.lobi_network_success_rate_numerator / planet.lobi_network_success_rate_denominator * 100).toFixed(2);
        embed.addFields({ name: 'LOBI Success Rate', value: `${successRate}%`, inline: true });
    }

    // Jamming Stations
    if (planet.orbital_jamming_station_quantity > 0 || planet.advanced_orbital_jamming_station_quantity > 0) {
        embed.addFields({ name: 'Jamming Stations', value: '\u200B' });
        if (planet.orbital_jamming_station_quantity > 0) {
            embed.addFields({ name: 'Orbital Jamming', value: planet.orbital_jamming_station_quantity.toString(), inline: true });
        }
        if (planet.advanced_orbital_jamming_station_quantity > 0) {
            embed.addFields({ name: 'Advanced Jamming', value: planet.advanced_orbital_jamming_station_quantity.toString(), inline: true });
        }
    }

    // Raid Protection
    if (planet.block_start_raid > 0) {
        embed.addFields({ name: 'Raid Protection', value: `Active since block ${planet.block_start_raid}`, inline: true });
    }

    return embed;
};

const createStructEmbed = async (struct) => {
    // Get Discord username for owner if available
    let ownerDisplay = struct.owner;
    if (struct.owner) {
        const discordUsername = await getDiscordUsername(struct.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${struct.owner})`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Struct: ${struct.struct_id}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Struct ID', value: struct.struct_id, inline: true },
            { name: 'Owner', value: ownerDisplay || 'None', inline: true },
            { name: 'Type', value: struct.type, inline: true },
            { name: 'Category', value: struct.category, inline: true },
            { name: 'Location', value: `${struct.location_type} ${struct.location_id}`, inline: true },
            { name: 'Slot', value: struct.slot.toString(), inline: true },
            { name: 'Health', value: `${struct.health}/${struct.max_health}`, inline: true }
        );

    // Status
    const statusFlags = [];
    if (struct.status.materialized) statusFlags.push('Materialized');
    if (struct.status.built) statusFlags.push('Built');
    if (struct.status.online) statusFlags.push('Online');
    if (struct.status.stored) statusFlags.push('Stored');
    if (struct.status.hidden) statusFlags.push('Hidden');
    if (struct.status.destroyed) statusFlags.push('Destroyed');
    if (struct.status.locked) statusFlags.push('Locked');
    embed.addFields({ name: 'Status', value: statusFlags.join(', ') || 'None' });

    // Build Status
    if (!struct.status.built) {
        embed.addFields(
            { name: 'Build Start', value: struct.block_start_build.toString(), inline: true },
            { name: 'Build Difficulty', value: struct.build_difficulty.toString(), inline: true }
        );
    }

    // Mining Status
    if (struct.planetary_mining !== 'noPlanetaryMining') {
        embed.addFields({ name: 'Mining Start', value: struct.block_start_ore_mine.toString(), inline: true });
    }

    // Refining Status
    if (struct.planetary_refinery !== 'noPlanetaryRefinery') {
        embed.addFields({ name: 'Refining Start', value: struct.block_start_ore_refine.toString(), inline: true });
    }

    // Power Generation
    if (struct.power_generation !== 'noPowerGeneration') {
        embed.addFields(
            { name: 'Fuel', value: struct.generator_fuel || '0', inline: true },
            { name: 'Load', value: struct.generator_load || '0', inline: true },
            { name: 'Capacity', value: struct.generator_capacity || '0', inline: true }
        );
    }

    // Weapons
    if (struct.primary_weapon || struct.secondary_weapon) {
        embed.addFields({ name: 'Weapons', value: '\u200B' });
        if (struct.primary_weapon) {
            embed.addFields({ name: 'Primary', value: struct.primary_weapon, inline: true });
        }
        if (struct.secondary_weapon) {
            embed.addFields({ name: 'Secondary', value: struct.secondary_weapon, inline: true });
        }
    }

    return embed;
};

const createFleetEmbed = async (fleet) => {
    // Get Discord username for owner if available
    let ownerDisplay = fleet.owner;
    if (fleet.owner) {
        const discordUsername = await getDiscordUsername(fleet.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${fleet.owner})`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Fleet: ${fleet.name || 'Unknown'}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Fleet ID', value: fleet.id, inline: true },
            { name: 'Type', value: fleet.fleet_type_name, inline: true },
            { name: 'Owner', value: ownerDisplay || 'None', inline: true }
        );

    return embed;
};

const createProviderEmbed = async (provider) => {
    // Get Discord username for owner if available
    let ownerDisplay = provider.owner;
    if (provider.owner) {
        const discordUsername = await getDiscordUsername(provider.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${provider.owner})`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Provider: ${provider.id}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Provider ID', value: provider.id, inline: true },
            { name: 'Owner', value: ownerDisplay || 'None', inline: true },
            { name: 'Substation ID', value: provider.substation_id || 'None', inline: true },
            { name: 'Rate', value: provider.rate || '0', inline: true },
            { name: 'Access Policy', value: provider.access_policy || 'None', inline: true },
            { name: 'Capacity Range', value: `${provider.capacity_minimum} - ${provider.capacity_maximum}`, inline: true },
            { name: 'Duration Range', value: `${provider.duration_minimum} - ${provider.duration_maximum} blocks`, inline: true },
            { name: 'Provider Cancellation Penalty', value: provider.provider_cancellation_pentalty.toString(), inline: true },
            { name: 'Consumer Cancellation Penalty', value: provider.consumer_cacellation_pentalty.toString(), inline: true }
        );

    return embed;
};

const createAllocationEmbed = async (allocation) => {
    // Get Discord username for controller if available
    let controllerDisplay = allocation.controller;
    if (allocation.controller) {
        const discordUsername = await getDiscordUsername(allocation.controller);
        if (discordUsername) {
            controllerDisplay = `${discordUsername} (${allocation.controller})`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Allocation: ${allocation.id}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Allocation ID', value: allocation.id, inline: true },
            { name: 'Type', value: allocation.allocation_type, inline: true },
            { name: 'Source ID', value: allocation.source_id, inline: true },
            { name: 'Destination ID', value: allocation.destination_id, inline: true },
            { name: 'Controller', value: controllerDisplay || 'None', inline: true },
            { name: 'Capacity', value: allocation.capacity || '0', inline: true }
        );

    return embed;
};

const createAgreementEmbed = async (agreement) => {
    // Get Discord username for owner if available
    let ownerDisplay = agreement.owner;
    if (agreement.owner) {
        const discordUsername = await getDiscordUsername(agreement.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${agreement.owner})`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Agreement: ${agreement.id}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Agreement ID', value: agreement.id, inline: true },
            { name: 'Provider ID', value: agreement.provider_id, inline: true },
            { name: 'Allocation ID', value: agreement.allocation_id, inline: true },
            { name: 'Capacity', value: agreement.capacity || '0', inline: true },
            { name: 'Duration', value: `${agreement.duration} blocks`, inline: true },
            { name: 'End Block', value: agreement.end_block.toString(), inline: true },
            { name: 'Owner', value: ownerDisplay || 'None', inline: true }
        );

    return embed;
};

const createSubstationEmbed = async (substation) => {
    // Get Discord username for owner if available
    let ownerDisplay = substation.owner;
    if (substation.owner) {
        const discordUsername = await getDiscordUsername(substation.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${substation.owner})`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Substation: ${substation.id}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Substation ID', value: substation.id, inline: true },
            { name: 'Owner', value: ownerDisplay || 'None', inline: true },
            { name: 'Location', value: substation.location_id, inline: true },
            { name: 'Status', value: substation.status || 'Unknown', inline: true },
            { name: 'Load', value: substation.load || '0', inline: true },
            { name: 'Capacity', value: substation.capacity || '0', inline: true }
        );

    return embed;
};

const createReactorEmbed = async (reactor) => {
    // Get Discord username for owner if available
    let ownerDisplay = reactor.owner;
    if (reactor.owner) {
        const discordUsername = await getDiscordUsername(reactor.owner);
        if (discordUsername) {
            ownerDisplay = `${discordUsername} (${reactor.owner})`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Reactor: ${reactor.reactor_id}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Reactor ID', value: reactor.reactor_id, inline: true },
            { name: 'Owner', value: ownerDisplay || 'None', inline: true },
            { name: 'Status', value: reactor.status || 'Unknown', inline: true },
            { name: 'Fuel', value: reactor.fuel || '0', inline: true },
            { name: 'Load', value: reactor.load || '0', inline: true },
            { name: 'Capacity', value: reactor.capacity || '0', inline: true }
        );

    // Add additional reactor-specific fields if they exist
    if (reactor.efficiency) {
        embed.addFields({ name: 'Efficiency', value: reactor.efficiency.toString(), inline: true });
    }
    if (reactor.heat) {
        embed.addFields({ name: 'Heat', value: reactor.heat.toString(), inline: true });
    }
    if (reactor.max_heat) {
        embed.addFields({ name: 'Max Heat', value: reactor.max_heat.toString(), inline: true });
    }

    return embed;
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
    }
};

module.exports = {
    createEmbeds
}; 