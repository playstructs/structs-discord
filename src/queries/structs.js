const db = require('../database');

const fetchPlayerData = {
    async byId(id) {
        return await db.query(
            `SELECT
                player.id as player_id,
                player_meta.username,
                player.guild_id,
                (select guild_meta.name from structs.guild_meta where guild_meta.id = player.guild_id) as guild_name,
                player.substation_id,
                player.planet_id,
                player.fleet_id,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='ore'),0),'ore') as ore,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='load'),0),'milliwatt') as load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='structsLoad'),0),'milliwatt') as structs_load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='capacity'),0),'milliwatt') as capacity,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.substation_id and grid.attribute_type='connectionCapacity'),0),'milliwatt') as connection_capacity,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='load'),0) + COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='structsLoad'),0),'milliwatt') as total_load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='capacity'),0) + COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.substation_id and grid.attribute_type='connectionCapacity'),0),'milliwatt')  as total_capacity,
                player.primary_address
            FROM structs.player 
            LEFT JOIN structs.player_meta ON player.id = player_meta.id
            WHERE player.id = $1`,
            [id]
        );
    },

    async byAddress(address) {
        return await db.query(
            `SELECT
                player.id as player_id,
                player_meta.username,
                (select guild_meta.name from structs.guild_meta where guild_meta.id = player.guild_id) as guild_name,
                player.substation_id,
                player.planet_id,
                player.fleet_id,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='ore'),0),'ore') as ore,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='load'),0),'milliwatt') as load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='structsLoad'),0),'milliwatt') as structs_load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='capacity'),0),'milliwatt') as capacity,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.substation_id and grid.attribute_type='connectionCapacity'),0),'milliwatt') as connection_capacity,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='load'),0) + COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='structsLoad'),0),'milliwatt') as total_load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='capacity'),0) + COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.substation_id and grid.attribute_type='connectionCapacity'),0),'milliwatt')  as total_capacity,
                player.primary_address
            FROM structs.player 
            LEFT JOIN structs.player_meta ON player.id = player_meta.id
            WHERE player.id = (select player_address.player_id from structs.player_address where player_address.address = $1)`,
            [address]
        );
    },

    async byDiscordId(discordId) {
        return await db.query(
            `SELECT
                player.id as player_id,
                player_meta.username,
                (select guild_meta.name from structs.guild_meta where guild_meta.id = player.guild_id) as guild_name,
                player.substation_id,
                player.planet_id,
                player.fleet_id,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='ore'),0),'ore') as ore,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='load'),0),'milliwatt') as load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='structsLoad'),0),'milliwatt') as structs_load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='capacity'),0),'milliwatt') as capacity,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.substation_id and grid.attribute_type='connectionCapacity'),0),'milliwatt') as connection_capacity,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='load'),0) + COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='structsLoad'),0),'milliwatt') as total_load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.id and grid.attribute_type='capacity'),0) + COALESCE((SELECT grid.val FROM structs.grid WHERE grid.object_id=player.substation_id and grid.attribute_type='connectionCapacity'),0),'milliwatt')  as total_capacity,
                player.primary_address
            FROM structs.player 
            LEFT JOIN structs.player_meta ON player.id = player_meta.id
            WHERE player.id = (select player_discord.player_id from structs.player_discord where player_discord.discord_id = $1)`,
            [discordId]
        );
    }
};

const fetchGuildData = {
    async byId(id) {
        return await db.query(
            `SELECT 
                guild.id,
                guild.primary_reactor_id,
                guild.entry_substation_id,
                structs.UNIT_DISPLAY_FORMAT(guild.join_infusion_minimum_p,'ualpha') as join_infusion_minimum,
                guild_meta.name,
                guild_meta.description,
                guild_meta.tag,
                guild_meta.logo,
                guild_meta.website 
            FROM 
                structs.guild 
                left join structs.guild_meta on guild.id=guild_meta.id 
            WHERE guild.id = $1`,
            [id]
        );
    },

    async byToken(token) {
        return await db.query(
            `SELECT g.* 
            FROM guilds g 
            WHERE g.token = $1`,
            [token]
        );
    },

    async byTag(tag) {
        return await db.query(
            `SELECT 
                guild.id,
                guild.primary_reactor_id,
                guild.entry_substation_id,
                structs.UNIT_DISPLAY_FORMAT(guild.join_infusion_minimum_p,'ualpha') as join_infusion_minimum,
                guild_meta.name,
                guild_meta.description,
                guild_meta.tag,
                guild_meta.logo,
                guild_meta.website 
            FROM 
                structs.guild 
                left join structs.guild_meta on guild.id=guild_meta.id 
            WHERE guild_meta.tag = $1`,
            [tag]
        );
    }
};

const fetchStructData = {
    async planet(id) {
        return await db.query(
            `SELECT
                id as planet_id,
                structs.UNIT_DISPLAY_FORMAT(max_ore,'ore') as max_ore,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='0-' || planet.owner),0),'ore') as vulnerable_ore,

                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='0-' || planet.id),0) as  planetary_shield,
                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='1-' || planet.id),0) as  repair_network_quantity,
                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='2-' || planet.id),0) as  defensive_cannon_quantity,
                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='3-' || planet.id),0) as  coordinated_global_shield_network_quantity,

                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='4-' || planet.id),0) as  low_orbit_ballistics_interceptor_network_quantity,
                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='5-' || planet.id),0) as  advanced_low_orbit_ballistics_interceptor_network_quantity,

                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='6-' || planet.id),0) as  lobi_network_success_rate_numerator,
                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='7-' || planet.id),0) as  lobi_network_success_rate_denominator,

                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='8-' || planet.id),0) as  orbital_jamming_station_quantity,
                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='9-' || planet.id),0) as  advanced_orbital_jamming_station_quantity,

                COALESCE((SELECT planet_attribute.val FROM structs.planet_attribute WHERE planet_attribute.id='10-' || planet.id),0) as  block_start_raid,

                owner,
                status
            FROM structs.planet
            WHERE id = $1`,
            [id]
        );
    },

    async reactor(id) {
        return await db.query(
            `SELECT                        
                id as reactor_id,
                guild_id,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='1-' || reactor.id),0),'ualpha') as fuel,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || reactor.id),0),'milliwatt') as load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || reactor.id),0),'milliwatt') as capacity
            FROM structs.reactor
            WHERE id = $1`,
            [id]
        );
    },

    async substation(id) {
        return await db.query(
            `SELECT
                id as substation_id,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || substation.id),0),'milliwatt') as load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || substation.id),0),'milliwatt') as capacity,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='6-' || substation.id),0),'milliwatt') as connection_capacity,
                COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='7-' || substation.id),0) as connection_count
            FROM structs.substation
            WHERE id = $1`,
            [id]
        );
    },

    async struct(id) {
        const result = await db.query(
            `SELECT
                struct.id as struct_id,
                index,

                location_type,
                location_id,
                operating_ambit,
                slot,

                COALESCE((SELECT struct_attribute.val FROM structs.struct_attribute WHERE struct_attribute.id='0-' || struct.id),0) as  health,
                struct_type.max_health,
                
                -- Only display if status built is false
                COALESCE((SELECT struct_attribute.val FROM structs.struct_attribute WHERE struct_attribute.id='2-' || struct.id),0) as  block_start_build,
                struct_type.build_difficulty,
                
                -- Only display if planetary_mining != noPlanetaryMining
                COALESCE((SELECT struct_attribute.val FROM structs.struct_attribute WHERE struct_attribute.id='3-' || struct.id),0) as  block_start_ore_mine,

                -- Only display if planetary_refinery != noPlanetaryRefinery
                COALESCE((SELECT struct_attribute.val FROM structs.struct_attribute WHERE struct_attribute.id='4-' || struct.id),0) as  block_start_ore_refine,

                -- Only display these if power_generation != noPowerGeneration
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='1-' || struct.id),0),'ualpha') as generator_fuel,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || struct.id),0),'milliwatt') as generator_load,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || struct.id),0),'milliwatt') as generator_capacity,

                struct_type.category,
                struct_type.type,
                structs.UNIT_DISPLAY_FORMAT(struct_type.passive_draw,'milliwatt') as passive_draw,

                struct_type.primary_weapon,
                struct_type.secondary_weapon,
                
                struct.owner,

                -- not to display, just for the use listed above
                struct_type.planetary_mining,
                struct_type.planetary_refinery,
                struct_type.power_generation
            FROM structs.struct, structs.struct_type
            WHERE struct_type.id = struct.type and struct.id = $1`,
            [id]
        );

        if (result.rows.length > 0) {
            const statusResult = await db.query(
                `SELECT
                    struct_attribute.object_id as struct_id,
                    (struct_attribute.val & 1) > 0 as materialized,
                    (struct_attribute.val & 2) > 0 as built,
                    (struct_attribute.val & 4) > 0 as online,
                    (struct_attribute.val & 8) > 0 as stored,
                    (struct_attribute.val & 16) > 0 as hidden,
                    (struct_attribute.val & 32) > 0 as destroyed,
                    (struct_attribute.val & 64) > 0 as locked,
                    struct_attribute.updated_at
                FROM structs.struct_attribute
                WHERE struct_attribute.attribute_type = 'status'
                    and struct_attribute.object_id = $1`,
                [id]
            );

            result.rows[0].status = statusResult.rows[0] || {};
        }

        return result;
    },

    async allocation(id) {
        return await db.query(
            `SELECT 
                id,
                allocation_type,
                source_id,
                destination_id,
                controller,
                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='5-' || allocation.id),0),'milliwatt') as capacity
            FROM structs.allocation
            WHERE id = $1`,
            [id]
        );
    },

    async fleet(id) {
        return await db.query(
            `SELECT f.*, ft.name as fleet_type_name 
            FROM fleets f 
            JOIN fleet_types ft ON f.fleet_type_id = ft.id 
            WHERE f.id = $1`,
            [id]
        );
    },

    async provider(id) {
        return await db.query(
            `SELECT 
                id, 
                substation_id,
                structs.UNIT_DISPLAY_FORMAT(rate_amount, rate_demon) as rate,
                access_policy,
                structs.UNIT_DISPLAY_FORMAT(capacity_minimum,'milliwatt') as capacity_minimum,
                structs.UNIT_DISPLAY_FORMAT(capacity_maximum,'milliwatt') as capacity_maximum,
                duration_minimum,
                duration_maximum,
                provider_cancellation_pentalty,
                consumer_cacellation_pentalty,
                owner
            FROM structs.provider 
            WHERE id = $1`,
            [id]
        );
    },

    async agreement(id) {
        return await db.query(
            `SELECT
                id,
                provider_id,
                structs.UNIT_DISPLAY_FORMAT(capacity,'milliwatt') as capacity,
                allocation_id,
                end_block,
                (end_block - start_block) as duration,
                owner 
            FROM structs.agreement
            WHERE id = $1`,
            [id]
        );
    }
};

module.exports = {
    fetchPlayerData,
    fetchGuildData,
    fetchStructData
}; 