const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');

// Object type enum
const ObjectType = {
    GUILD: 0,
    PLAYER: 1,
    PLANET: 2,
    REACTOR: 3,
    SUBSTATION: 4,
    STRUCT: 5,
    ALLOCATION: 6,
    INFUSION: 7,
    ADDRESS: 8,
    FLEET: 9,
    PROVIDER: 10,
    AGREEMENT: 11
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('structs')
        .setDescription('Structs game commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get information about a player or struct')
                .addStringOption(option =>
                    option.setName('identifier')
                        .setDescription('ID, address, token, tag, or @discord mention')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('top')
                .setDescription('View top rankings')
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Category to view')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Players', value: 'players' },
                            { name: 'Guilds', value: 'guilds' },
                            { name: 'Providers', value: 'providers' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join a guild')
                .addStringOption(option =>
                    option.setName('guild')
                        .setDescription('Select a guild to join')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('build')
                .setDescription('Build a new struct')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of struct to build')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Planetary', value: 'planetary' },
                            { name: 'Fleet', value: 'fleet' }
                        ))
                .addStringOption(option =>
                    option.setName('ambit')
                        .setDescription('Ambit of the struct')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Space', value: 'space' },
                            { name: 'Air', value: 'air' },
                            { name: 'Land', value: 'land' },
                            { name: 'Water', value: 'water' }
                        ))
                .addStringOption(option =>
                    option.setName('struct_type')
                        .setDescription('Specific struct type to build')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('explore')
                .setDescription('Explore the game world'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('move')
                .setDescription('Move to another player')
                .addUserOption(option =>
                    option.setName('player')
                        .setDescription('Player to move to')
                        .setRequired(true)))
        .addSubcommandGroup(group =>
            group
                .setName('compute')
                .setDescription('Compute operations')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('build')
                        .setDescription('Compute build operation')
                        .addStringOption(option =>
                            option.setName('struct')
                                .setDescription('Select a struct to build')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('nonce')
                                .setDescription('Hash nonce')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('mine')
                        .setDescription('Compute mining operation')
                        .addStringOption(option =>
                            option.setName('struct')
                                .setDescription('Select a mining struct')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('nonce')
                                .setDescription('Hash nonce')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('refine')
                        .setDescription('Compute refining operation')
                        .addStringOption(option =>
                            option.setName('struct')
                                .setDescription('Select a refining struct')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('raid')
                        .setDescription('Compute raid operation')
                        .addStringOption(option =>
                            option.setName('nonce')
                                .setDescription('Hash nonce')
                                .setRequired(true)))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup();

        try {
            switch (subcommandGroup || subcommand) {
                case 'info':
                    await handleInfo(interaction);
                    break;
                case 'top':
                    await handleTop(interaction);
                    break;
                case 'join':
                    await handleJoin(interaction);
                    break;
                case 'build':
                    await handleBuild(interaction);
                    break;
                case 'explore':
                    await handleExplore(interaction);
                    break;
                case 'move':
                    await handleMove(interaction);
                    break;
                case 'compute':
                    await handleCompute(interaction);
                    break;
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: 'There was an error executing this command!', 
                ephemeral: true 
            });
        }
    }
};

async function handleInfo(interaction) {
    const identifier = interaction.options.getString('identifier');
    
    // Check if the identifier matches the ID format (type-index)
    const idMatch = identifier.match(/^(\d+)-(\d+)$/);
    
    if (idMatch) {
        const [_, type, index] = idMatch;
        const typeNum = parseInt(type);
        const indexNum = parseInt(index);

        // Validate that both type and index are valid integers
        if (isNaN(typeNum) || isNaN(indexNum)) {
            await interaction.reply('Invalid ID format: Type and index must be valid integers.');
            return;
        }

        // Validate that type is within the valid range
        if (typeNum < 0 || typeNum > 11) {
            await interaction.reply('Invalid object type. Type must be between 0 and 11.');
            return;
        }

        // Validate that index is positive
        if (indexNum <= 0) {
            await interaction.reply('Invalid index. Index must be a positive number.');
            return;
        }

        await handleIdLookup(interaction, typeNum, indexNum);
    } else if (identifier.startsWith('0x')) {
        // Handle address lookup
        await handleAddressLookup(interaction, identifier);
    } else if (identifier.startsWith('@')) {
        // Handle Discord mention lookup
        await handleDiscordLookup(interaction, identifier);
    } else if (identifier.startsWith('token-')) {
        // Handle token lookup
        await handleTokenLookup(interaction, identifier);
    } else if (identifier.startsWith('tag-')) {
        // Handle tag lookup
        await handleTagLookup(interaction, identifier);
    } else {
        await interaction.reply('Invalid identifier format. Please use one of:\n' +
            '- ID format: <type>-<index> (type: 0-11, index: positive integer)\n' +
            '- Address: 0x...\n' +
            '- Token: token-<token>\n' +
            '- Tag: tag-<tag>\n' +
            '- Discord: @username');
    }
}

async function handleIdLookup(interaction, type, index) {
    try {
        let result;
        let embed;
        const fullId = `${type}-${index}`;

        switch (type) {
            case ObjectType.GUILD:
                result = await db.query(
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
                    [fullId]
                );
                if (result.rows.length > 0) {
                    const guild = result.rows[0];
                    const embeds = [createGuildEmbed(guild)];

                    // Fetch and add primary reactor embed if it exists
                    if (guild.primary_reactor_id) {
                        const reactorResult = await db.query(
                            `SELECT                        
                                id as reactor_id,
                                guild_id,
                                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='1-' || reactor.id),0),'ualpha') as fuel,
                                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || reactor.id),0),'milliwatt') as load,
                                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || reactor.id),0),'milliwatt') as capacity
                            FROM structs.reactor
                            WHERE id = $1`,
                            [guild.primary_reactor_id]
                        );
                        if (reactorResult.rows.length > 0) {
                            embeds.push(createReactorEmbed(reactorResult.rows[0]));
                        }
                    }

                    // Fetch and add entry substation embed if it exists
                    if (guild.entry_substation_id) {
                        const substationResult = await db.query(
                            `SELECT
                                id as substation_id,
                                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || substation.id),0),'milliwatt') as load,
                                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || substation.id),0),'milliwatt') as capacity,
                                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='6-' || substation.id),0),'milliwatt') as connection_capacity,
                                COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='7-' || substation.id),0) as connection_count
                            FROM structs.substation
                            WHERE id = $1`,
                            [guild.entry_substation_id]
                        );
                        if (substationResult.rows.length > 0) {
                            embeds.push(createSubstationEmbed(substationResult.rows[0]));
                        }
                    }

                    await interaction.reply({ embeds });
                }
                break;

            case ObjectType.PLAYER:
                result = await db.query(
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
                    WHERE player.id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createPlayerEmbed(result.rows[0]);
                }
                break;

            case ObjectType.PLANET:
                result = await db.query(
                    `SELECT
                        id as planet_id,
                        structs.UNIT_DISPLAY_FORMAT(max_ore,'ore') as max_ore,
                        structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='0-' || planet.id),0),'ore') as buried_ore,
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
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createPlanetEmbed(result.rows[0]);
                }
                break;

            case ObjectType.REACTOR:
                result = await db.query(
                    `SELECT                        
                        id as reactor_id,
                        guild_id,
                        structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='1-' || reactor.id),0),'ualpha') as fuel,
                        structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || reactor.id),0),'milliwatt') as load,
                        structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || reactor.id),0),'milliwatt') as capacity
                    FROM structs.reactor
                    WHERE id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createReactorEmbed(result.rows[0]);
                }
                break;

            case ObjectType.SUBSTATION:
                result = await db.query(
                    `SELECT
                        id as substation_id,
                        structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || substation.id),0),'milliwatt') as load,
                        structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || substation.id),0),'milliwatt') as capacity,
                        structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='6-' || substation.id),0),'milliwatt') as connection_capacity,
                        COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='7-' || substation.id),0) as connection_count
                    FROM structs.substation
                    WHERE id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createSubstationEmbed(result.rows[0]);
                }
                break;

            case ObjectType.STRUCT:
                result = await db.query(
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
                    [fullId]
                );

                if (result.rows.length > 0) {
                    const struct = result.rows[0];
                    
                    // Get status information
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
                        [fullId]
                    );

                    const status = statusResult.rows[0] || {};
                    embed = createStructEmbed(struct, status);
                }
                break;

            case ObjectType.ALLOCATION:
                result = await db.query(
                    `SELECT 
                        id,
                        allocation_type,
                        source_id,
                        destination_id,
                        controller,
                        structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='5-' || allocation.id),0),'milliwatt') as capacity
                    FROM structs.allocation
                    WHERE id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    const allocation = result.rows[0];
                    const embeds = [createAllocationEmbed(allocation)];

                    // Fetch and add substation embed if it exists
                    if (allocation.destination_id) {
                        const substationResult = await db.query(
                            `SELECT
                                id as substation_id,
                                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || substation.id),0),'milliwatt') as load,
                                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || substation.id),0),'milliwatt') as capacity,
                                structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='6-' || substation.id),0),'milliwatt') as connection_capacity,
                                COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='7-' || substation.id),0) as connection_count
                            FROM structs.substation
                            WHERE id = $1`,
                            [allocation.destination_id]
                        );
                        if (substationResult.rows.length > 0) {
                            embeds.push(createSubstationEmbed(substationResult.rows[0]));
                        }
                    }

                    await interaction.reply({ embeds });
                }
                break;

            case ObjectType.FLEET:
                result = await db.query(
                    `SELECT f.*, ft.name as fleet_type_name 
                    FROM fleets f 
                    JOIN fleet_types ft ON f.fleet_type_id = ft.id 
                    WHERE f.id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createFleetEmbed(result.rows[0]);
                }
                break;

            case ObjectType.PROVIDER:
                result = await db.query(
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
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createProviderEmbed(result.rows[0]);
                }
                break;

            case ObjectType.AGREEMENT:
                result = await db.query(
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
                    [fullId]
                );
                if (result.rows.length > 0) {
                    const agreement = result.rows[0];
                    const embeds = [createAgreementEmbed(agreement)];

                    // Fetch and add provider embed if it exists
                    if (agreement.provider_id) {
                        const providerResult = await db.query(
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
                            [agreement.provider_id]
                        );
                        if (providerResult.rows.length > 0) {
                            embeds.push(createProviderEmbed(providerResult.rows[0]));
                        }
                    }

                    await interaction.reply({ embeds });
                }
                break;

            default:
                await interaction.reply(`Invalid object type: ${type}`);
                return;
        }

        if (result.rows.length === 0) {
            await interaction.reply(`No object found with ID ${fullId}`);
            return;
        }

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleIdLookup:', error);
        await interaction.reply({ 
            content: 'There was an error fetching the object information.', 
            ephemeral: true 
        });
    }
}

async function handleAddressLookup(interaction, address) {
    try {
        const result = await db.query(
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

        if (result.rows.length === 0) {
            await interaction.reply(`No player found with address ${address}`);
            return;
        }

        const embed = createPlayerEmbed(result.rows[0]);
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleAddressLookup:', error);
        await interaction.reply({ 
            content: 'There was an error fetching the player information.', 
            ephemeral: true 
        });
    }
}

async function handleDiscordLookup(interaction, mention) {
    try {
        // Extract Discord ID from mention
        const discordId = mention.replace(/[<@!>]/g, '');
        
        const result = await db.query(
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
            WHERE player_meta.username = $1`,
            [discordId]
        );

        if (result.rows.length === 0) {
            await interaction.reply(`No player found for Discord user ${mention}`);
            return;
        }

        const embed = createPlayerEmbed(result.rows[0]);
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleDiscordLookup:', error);
        await interaction.reply({ 
            content: 'There was an error fetching the player information.', 
            ephemeral: true 
        });
    }
}

async function handleTokenLookup(interaction, token) {
    try {
        const result = await db.query(
            `SELECT g.* 
            FROM guilds g 
            WHERE g.token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            await interaction.reply(`No guild found with token ${token}`);
            return;
        }

        const embed = createGuildEmbed(result.rows[0]);
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleTokenLookup:', error);
        await interaction.reply({ 
            content: 'There was an error fetching the guild information.', 
            ephemeral: true 
        });
    }
}

async function handleTagLookup(interaction, tag) {
    try {
        const result = await db.query(
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

        if (result.rows.length === 0) {
            await interaction.reply(`No guild found with tag ${tag}`);
            return;
        }

        const guild = result.rows[0];
        const embeds = [createGuildEmbed(guild)];

        // Fetch and add primary reactor embed if it exists
        if (guild.primary_reactor_id) {
            const reactorResult = await db.query(
                `SELECT                        
                    id as reactor_id,
                    guild_id,
                    structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='1-' || reactor.id),0),'ualpha') as fuel,
                    structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || reactor.id),0),'milliwatt') as load,
                    structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || reactor.id),0),'milliwatt') as capacity
                FROM structs.reactor
                WHERE id = $1`,
                [guild.primary_reactor_id]
            );
            if (reactorResult.rows.length > 0) {
                embeds.push(createReactorEmbed(reactorResult.rows[0]));
            }
        }

        // Fetch and add entry substation embed if it exists
        if (guild.entry_substation_id) {
            const substationResult = await db.query(
                `SELECT
                    id as substation_id,
                    structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='3-' || substation.id),0),'milliwatt') as load,
                    structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='2-' || substation.id),0),'milliwatt') as capacity,
                    structs.UNIT_DISPLAY_FORMAT(COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='6-' || substation.id),0),'milliwatt') as connection_capacity,
                    COALESCE((SELECT grid.val FROM structs.grid WHERE grid.id='7-' || substation.id),0) as connection_count
                FROM structs.substation
                WHERE id = $1`,
                [guild.entry_substation_id]
            );
            if (substationResult.rows.length > 0) {
                embeds.push(createSubstationEmbed(substationResult.rows[0]));
            }
        }

        await interaction.reply({ embeds });
    } catch (error) {
        console.error('Error in handleTagLookup:', error);
        await interaction.reply({ 
            content: 'There was an error fetching the guild information.', 
            ephemeral: true 
        });
    }
}

function createGuildEmbed(guild) {
    return {
        title: `Guild Information (${guild.id})`,
        fields: [
            { name: 'Name', value: guild.name || 'Unnamed Guild', inline: true },
            { name: 'Tag', value: guild.tag || 'No Tag', inline: true },
            { name: 'Primary Reactor', value: guild.primary_reactor_id ? `Reactor ${guild.primary_reactor_id}` : 'None', inline: true },
            { name: 'Entry Substation', value: guild.entry_substation_id ? `Substation ${guild.entry_substation_id}` : 'None', inline: true },
            { name: 'Join Minimum', value: guild.join_infusion_minimum, inline: true },
            { name: 'Website', value: guild.website || 'No Website', inline: true },
            { name: 'Description', value: guild.description || 'No description', inline: false }
        ],
        color: 0x0099FF
    };
}

function createPlayerEmbed(player) {
    return {
        title: `Player Information (${player.player_id})`,
        fields: [
            { name: 'Username', value: player.username || 'Unknown', inline: true },
            { name: 'Guild', value: player.guild_name || 'No Guild', inline: true },
            { name: 'Address', value: player.primary_address || 'No Address', inline: true },
            { name: 'Substation', value: player.substation_id ? `Substation ${player.substation_id}` : 'None', inline: true },
            { name: 'Planet', value: player.planet_id ? `Planet ${player.planet_id}` : 'None', inline: true },
            { name: 'Fleet', value: player.fleet_id ? `Fleet ${player.fleet_id}` : 'None', inline: true },
            { name: 'Resources', value: `Ore: ${player.ore}`, inline: true },
            { name: 'Power Load', value: `Base: ${player.load}\nStructs: ${player.structs_load}\nTotal: ${player.total_load}`, inline: true },
            { name: 'Power Capacity', value: `Base: ${player.capacity}\nConnection: ${player.connection_capacity}\nTotal: ${player.total_capacity}`, inline: true }
        ],
        color: 0x0099FF
    };
}

function createPlanetEmbed(planet) {
    const lobiSuccessRate = planet.lobi_network_success_rate_denominator > 0 
        ? (planet.lobi_network_success_rate_numerator / planet.lobi_network_success_rate_denominator * 100).toFixed(1) + '%'
        : '0%';

    return {
        title: `Planet Information (${planet.planet_id})`,
        fields: [
            { name: 'Owner', value: `<@${planet.owner}>`, inline: true },
            { name: 'Status', value: planet.status, inline: true },
            { name: 'Ore', value: `Max: ${planet.max_ore}\nBuried: ${planet.buried_ore}\nVulnerable: ${planet.vulnerable_ore}`, inline: true },
            { name: 'Defenses', value: `Planetary Shield: ${planet.planetary_shield}\nRepair Network: ${planet.repair_network_quantity}\nDefensive Cannons: ${planet.defensive_cannon_quantity}`, inline: true },
            { name: 'Shield Network', value: `Coordinated Global Shield: ${planet.coordinated_global_shield_network_quantity}`, inline: true },
            { name: 'Interceptor Networks', value: `LOBI: ${planet.low_orbit_ballistics_interceptor_network_quantity}\nAdvanced LOBI: ${planet.advanced_low_orbit_ballistics_interceptor_network_quantity}`, inline: true },
            { name: 'LOBI Success Rate', value: lobiSuccessRate, inline: true },
            { name: 'Jamming Stations', value: `Orbital: ${planet.orbital_jamming_station_quantity}\nAdvanced: ${planet.advanced_orbital_jamming_station_quantity}`, inline: true },
            { name: 'Raid Protection', value: planet.block_start_raid ? 'Active' : 'Inactive', inline: true }
        ],
        color: 0x0099FF
    };
}

function createStructEmbed(struct, status) {
    const fields = [
        { name: 'Owner', value: `<@${struct.owner}>`, inline: true },
        { name: 'Location', value: `${struct.location_type} ${struct.location_id}`, inline: true },
        { name: 'Slot', value: `${struct.operating_ambit} ${struct.slot}`, inline: true },
        { name: 'Type', value: `${struct.category} ${struct.type}`, inline: true },
        { name: 'Status', value: getStatusString(status), inline: true },
        { name: 'Health', value: `${struct.health}/${struct.max_health}`, inline: true }
    ];

    // Add build information if not built
    if (!status.built) {
        fields.push(
            { name: 'Build Status', value: struct.block_start_build ? 'Blocked' : 'Ready', inline: true },
            { name: 'Build Difficulty', value: struct.build_difficulty.toString(), inline: true }
        );
    }

    // Add mining information if applicable
    if (struct.planetary_mining !== 'noPlanetaryMining') {
        fields.push(
            { name: 'Mining Status', value: struct.block_start_ore_mine ? 'Blocked' : 'Ready', inline: true }
        );
    }

    // Add refining information if applicable
    if (struct.planetary_refinery !== 'noPlanetaryRefinery') {
        fields.push(
            { name: 'Refining Status', value: struct.block_start_ore_refine ? 'Blocked' : 'Ready', inline: true }
        );
    }

    // Add power information if applicable
    if (struct.power_generation !== 'noPowerGeneration') {
        fields.push(
            { name: 'Power Generation', value: `Fuel: ${struct.generator_fuel}\nLoad: ${struct.generator_load}\nCapacity: ${struct.generator_capacity}`, inline: true }
        );
    }

    // Add weapon information if present
    if (struct.primary_weapon || struct.secondary_weapon) {
        fields.push(
            { name: 'Weapons', value: `Primary: ${struct.primary_weapon || 'None'}\nSecondary: ${struct.secondary_weapon || 'None'}`, inline: true }
        );
    }

    // Add passive draw
    fields.push(
        { name: 'Passive Draw', value: struct.passive_draw, inline: true }
    );

    return {
        title: `Struct Information (${struct.struct_id})`,
        fields: fields,
        color: 0x0099FF
    };
}

function getStatusString(status) {
    const statusFlags = [];
    if (status.materialized) statusFlags.push('Materialized');
    if (status.built) statusFlags.push('Built');
    if (status.online) statusFlags.push('Online');
    if (status.stored) statusFlags.push('Stored');
    if (status.hidden) statusFlags.push('Hidden');
    if (status.destroyed) statusFlags.push('Destroyed');
    if (status.locked) statusFlags.push('Locked');
    
    return statusFlags.length > 0 ? statusFlags.join(', ') : 'Unknown';
}

function createFleetEmbed(fleet) {
    return {
        title: `Fleet Information (${fleet.id})`,
        fields: [
            { name: 'Type', value: fleet.fleet_type_name, inline: true },
            { name: 'Owner', value: `<@${fleet.owner_id}>`, inline: true },
            { name: 'Status', value: fleet.status, inline: true },
            { name: 'Created At', value: new Date(fleet.created_at).toLocaleString(), inline: true },
            { name: 'Last Active', value: fleet.last_active ? new Date(fleet.last_active).toLocaleString() : 'Never', inline: true },
            { name: 'Resources', value: `Metal: ${fleet.metal}\nCrystal: ${fleet.crystal}\nDeuterium: ${fleet.deuterium}`, inline: false }
        ],
        color: 0x0099FF
    };
}

function createProviderEmbed(provider) {
    return {
        title: `Provider Information (${provider.id})`,
        fields: [
            { name: 'Owner', value: `<@${provider.owner}>`, inline: true },
            { name: 'Substation', value: provider.substation_id ? `Substation ${provider.substation_id}` : 'None', inline: true },
            { name: 'Access Policy', value: provider.access_policy, inline: true },
            { name: 'Rate', value: provider.rate, inline: true },
            { name: 'Capacity Range', value: `${provider.capacity_minimum} - ${provider.capacity_maximum}`, inline: true },
            { name: 'Duration Range', value: `${provider.duration_minimum} - ${provider.duration_maximum} hours`, inline: true },
            { name: 'Cancellation Penalties', value: `Provider: ${provider.provider_cancellation_pentalty}%\nConsumer: ${provider.consumer_cacellation_pentalty}%`, inline: true }
        ],
        color: 0x0099FF
    };
}

function createReactorEmbed(reactor) {
    return {
        title: `Reactor Information (${reactor.reactor_id})`,
        fields: [
            { name: 'Guild', value: reactor.guild_id ? `Guild ${reactor.guild_id}` : 'No Guild', inline: true },
            { name: 'Fuel', value: reactor.fuel, inline: true },
            { name: 'Load', value: reactor.load, inline: true },
            { name: 'Capacity', value: reactor.capacity, inline: true }
        ],
        color: 0x0099FF
    };
}

function createSubstationEmbed(substation) {
    return {
        title: `Substation Information (${substation.substation_id})`,
        fields: [
            { name: 'Load', value: substation.load, inline: true },
            { name: 'Capacity', value: substation.capacity, inline: true },
            { name: 'Connection Capacity', value: substation.connection_capacity, inline: true },
            { name: 'Connected Allocations', value: substation.connection_count.toString(), inline: true }
        ],
        color: 0x0099FF
    };
}

function createAllocationEmbed(allocation) {
    return {
        title: `Allocation Information (${allocation.id})`,
        fields: [
            { name: 'Type', value: allocation.allocation_type, inline: true },
            { name: 'Controller', value: `<@${allocation.controller}>`, inline: true },
            { name: 'Source', value: `ID: ${allocation.source_id}`, inline: true },
            { name: 'Destination', value: `Substation ${allocation.destination_id}`, inline: true },
            { name: 'Capacity', value: allocation.capacity, inline: true }
        ],
        color: 0x0099FF
    };
}

function createAgreementEmbed(agreement) {
    return {
        title: `Agreement Information (${agreement.id})`,
        fields: [
            { name: 'Owner', value: `<@${agreement.owner}>`, inline: true },
            { name: 'Provider', value: `Provider ${agreement.provider_id}`, inline: true },
            { name: 'Allocation', value: `Allocation ${agreement.allocation_id}`, inline: true },
            { name: 'Capacity', value: agreement.capacity, inline: true },
            { name: 'Duration', value: `${agreement.duration} blocks`, inline: true },
            { name: 'End Block', value: agreement.end_block.toString(), inline: true }
        ],
        color: 0x0099FF
    };
}

async function handleTop(interaction) {
    const category = interaction.options.getString('category');
    // TODO: Implement top rankings logic
    await interaction.reply(`Top ${category} rankings`);
}

async function handleJoin(interaction) {
    const guild = interaction.options.getString('guild');
    // TODO: Implement guild join logic
    await interaction.reply(`Joining guild: ${guild}`);
}

async function handleBuild(interaction) {
    const type = interaction.options.getString('type');
    const ambit = interaction.options.getString('ambit');
    const structType = interaction.options.getString('struct_type');
    // TODO: Implement build logic
    await interaction.reply(`Building ${type} struct of type ${structType} in ${ambit} ambit`);
}

async function handleExplore(interaction) {
    // TODO: Implement explore logic
    await interaction.reply('Exploring the game world...');
}

async function handleMove(interaction) {
    const player = interaction.options.getUser('player');
    // TODO: Implement move logic
    await interaction.reply(`Moving to player: ${player.username}`);
}

async function handleCompute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
        case 'build':
            const buildStruct = interaction.options.getString('struct');
            const buildNonce = interaction.options.getString('nonce');
            await interaction.reply(`Computing build for struct ${buildStruct} with nonce ${buildNonce}`);
            break;
        case 'mine':
            const mineStruct = interaction.options.getString('struct');
            const mineNonce = interaction.options.getString('nonce');
            await interaction.reply(`Computing mining for struct ${mineStruct} with nonce ${mineNonce}`);
            break;
        case 'refine':
            const refineStruct = interaction.options.getString('struct');
            await interaction.reply(`Computing refining for struct ${refineStruct}`);
            break;
        case 'raid':
            const raidNonce = interaction.options.getString('nonce');
            await interaction.reply(`Computing raid with nonce ${raidNonce}`);
            break;
    }
} 