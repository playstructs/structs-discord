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
                    `SELECT * FROM guilds WHERE id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createGuildEmbed(result.rows[0]);
                }
                break;

            case ObjectType.PLAYER:
                result = await db.query(
                    `SELECT * FROM players WHERE id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createPlayerEmbed(result.rows[0]);
                }
                break;

            case ObjectType.PLANET:
                result = await db.query(
                    `SELECT p.*, pa.last_active 
                    FROM planets p 
                    LEFT JOIN planet_activity pa ON p.id = pa.planet_id 
                    WHERE p.id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createPlanetEmbed(result.rows[0]);
                }
                break;

            case ObjectType.REACTOR:
                result = await db.query(
                    `SELECT r.*, rt.name as reactor_type_name 
                    FROM reactors r 
                    JOIN reactor_types rt ON r.reactor_type_id = rt.id 
                    WHERE r.id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createReactorEmbed(result.rows[0]);
                }
                break;

            case ObjectType.SUBSTATION:
                result = await db.query(
                    `SELECT s.*, st.name as substation_type_name 
                    FROM substations s 
                    JOIN substation_types st ON s.substation_type_id = st.id 
                    WHERE s.id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createSubstationEmbed(result.rows[0]);
                }
                break;

            case ObjectType.STRUCT:
                result = await db.query(
                    `SELECT s.*, st.name as struct_type_name 
                    FROM structs s 
                    JOIN struct_types st ON s.struct_type_id = st.id 
                    WHERE s.id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createStructEmbed(result.rows[0]);
                }
                break;

            case ObjectType.ALLOCATION:
                result = await db.query(
                    `SELECT a.*, at.name as allocation_type_name 
                    FROM allocations a 
                    JOIN allocation_types at ON a.allocation_type_id = at.id 
                    WHERE a.id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createAllocationEmbed(result.rows[0]);
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
                    `SELECT * FROM providers WHERE id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createProviderEmbed(result.rows[0]);
                }
                break;

            case ObjectType.AGREEMENT:
                result = await db.query(
                    `SELECT a.*, p.name as provider_name, c.name as consumer_name 
                    FROM agreements a 
                    JOIN providers p ON a.provider_id = p.id 
                    JOIN consumers c ON a.consumer_id = c.id 
                    WHERE a.id = $1`,
                    [fullId]
                );
                if (result.rows.length > 0) {
                    embed = createAgreementEmbed(result.rows[0]);
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
            `SELECT p.* 
            FROM players p 
            WHERE p.address = $1`,
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
            `SELECT p.* 
            FROM players p 
            WHERE p.discord_id = $1`,
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
            `SELECT g.* 
            FROM guilds g 
            WHERE g.tag = $1`,
            [tag]
        );

        if (result.rows.length === 0) {
            await interaction.reply(`No guild found with tag ${tag}`);
            return;
        }

        const embed = createGuildEmbed(result.rows[0]);
        await interaction.reply({ embeds: [embed] });
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
            { name: 'Name', value: guild.name, inline: true },
            { name: 'Created At', value: new Date(guild.created_at).toLocaleString(), inline: true },
            { name: 'Member Count', value: guild.member_count.toString(), inline: true },
            { name: 'Description', value: guild.description || 'No description', inline: false }
        ],
        color: 0x0099FF
    };
}

function createPlayerEmbed(player) {
    return {
        title: `Player Information (${player.id})`,
        fields: [
            { name: 'Name', value: player.name, inline: true },
            { name: 'Discord ID', value: player.discord_id, inline: true },
            { name: 'Created At', value: new Date(player.created_at).toLocaleString(), inline: true },
            { name: 'Last Active', value: new Date(player.last_active).toLocaleString(), inline: true },
            { name: 'Resources', value: `Metal: ${player.metal}\nCrystal: ${player.crystal}\nDeuterium: ${player.deuterium}`, inline: false }
        ],
        color: 0x0099FF
    };
}

function createPlanetEmbed(planet) {
    return {
        title: `Planet Information (${planet.id})`,
        fields: [
            { name: 'Name', value: planet.name, inline: true },
            { name: 'Owner', value: `<@${planet.owner_id}>`, inline: true },
            { name: 'Coordinates', value: `X: ${planet.x}, Y: ${planet.y}`, inline: true },
            { name: 'Population', value: planet.population.toString(), inline: true },
            { name: 'Last Active', value: planet.last_active ? new Date(planet.last_active).toLocaleString() : 'Never', inline: true },
            { name: 'Resources', value: `Metal: ${planet.metal}\nCrystal: ${planet.crystal}\nDeuterium: ${planet.deuterium}`, inline: false }
        ],
        color: 0x0099FF
    };
}

function createStructEmbed(struct) {
    return {
        title: `Struct Information (${struct.id})`,
        fields: [
            { name: 'Type', value: struct.struct_type_name, inline: true },
            { name: 'Owner', value: `<@${struct.owner_id}>`, inline: true },
            { name: 'Status', value: struct.status, inline: true },
            { name: 'Created At', value: new Date(struct.created_at).toLocaleString(), inline: true },
            { name: 'Last Active', value: struct.last_active ? new Date(struct.last_active).toLocaleString() : 'Never', inline: true },
            { name: 'Resources', value: `Metal: ${struct.metal}\nCrystal: ${struct.crystal}\nDeuterium: ${struct.deuterium}`, inline: false }
        ],
        color: 0x0099FF
    };
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
            { name: 'Name', value: provider.name, inline: true },
            { name: 'Owner', value: `<@${provider.owner_id}>`, inline: true },
            { name: 'Status', value: provider.status, inline: true },
            { name: 'Created At', value: new Date(provider.created_at).toLocaleString(), inline: true },
            { name: 'Last Active', value: provider.last_active ? new Date(provider.last_active).toLocaleString() : 'Never', inline: true },
            { name: 'Resources', value: `Metal: ${provider.metal}\nCrystal: ${provider.crystal}\nDeuterium: ${provider.deuterium}`, inline: false }
        ],
        color: 0x0099FF
    };
}

function createReactorEmbed(reactor) {
    return {
        title: `Reactor Information (${reactor.id})`,
        fields: [
            { name: 'Type', value: reactor.reactor_type_name, inline: true },
            { name: 'Owner', value: `<@${reactor.owner_id}>`, inline: true },
            { name: 'Status', value: reactor.status, inline: true },
            { name: 'Created At', value: new Date(reactor.created_at).toLocaleString(), inline: true },
            { name: 'Last Active', value: reactor.last_active ? new Date(reactor.last_active).toLocaleString() : 'Never', inline: true },
            { name: 'Power Output', value: `${reactor.power_output} MW`, inline: true },
            { name: 'Efficiency', value: `${reactor.efficiency}%`, inline: true },
            { name: 'Resources', value: `Metal: ${reactor.metal}\nCrystal: ${reactor.crystal}\nDeuterium: ${reactor.deuterium}`, inline: false }
        ],
        color: 0x0099FF
    };
}

function createSubstationEmbed(substation) {
    return {
        title: `Substation Information (${substation.id})`,
        fields: [
            { name: 'Type', value: substation.substation_type_name, inline: true },
            { name: 'Owner', value: `<@${substation.owner_id}>`, inline: true },
            { name: 'Status', value: substation.status, inline: true },
            { name: 'Created At', value: new Date(substation.created_at).toLocaleString(), inline: true },
            { name: 'Last Active', value: substation.last_active ? new Date(substation.last_active).toLocaleString() : 'Never', inline: true },
            { name: 'Capacity', value: `${substation.capacity} MW`, inline: true },
            { name: 'Connected Allocations', value: substation.connected_allocations_count.toString(), inline: true },
            { name: 'Resources', value: `Metal: ${substation.metal}\nCrystal: ${substation.crystal}\nDeuterium: ${substation.deuterium}`, inline: false }
        ],
        color: 0x0099FF
    };
}

function createAllocationEmbed(allocation) {
    return {
        title: `Allocation Information (${allocation.id})`,
        fields: [
            { name: 'Type', value: allocation.allocation_type_name, inline: true },
            { name: 'Owner', value: `<@${allocation.owner_id}>`, inline: true },
            { name: 'Status', value: allocation.status, inline: true },
            { name: 'Created At', value: new Date(allocation.created_at).toLocaleString(), inline: true },
            { name: 'Last Active', value: allocation.last_active ? new Date(allocation.last_active).toLocaleString() : 'Never', inline: true },
            { name: 'Capacity', value: `${allocation.capacity} MW`, inline: true },
            { name: 'Connected Substation', value: allocation.substation_id ? `Substation ${allocation.substation_id}` : 'None', inline: true },
            { name: 'Resources', value: `Metal: ${allocation.metal}\nCrystal: ${allocation.crystal}\nDeuterium: ${allocation.deuterium}`, inline: false }
        ],
        color: 0x0099FF
    };
}

function createAgreementEmbed(agreement) {
    return {
        title: `Agreement Information (${agreement.id})`,
        fields: [
            { name: 'Provider', value: agreement.provider_name, inline: true },
            { name: 'Consumer', value: agreement.consumer_name, inline: true },
            { name: 'Status', value: agreement.status, inline: true },
            { name: 'Created At', value: new Date(agreement.created_at).toLocaleString(), inline: true },
            { name: 'Last Active', value: agreement.last_active ? new Date(agreement.last_active).toLocaleString() : 'Never', inline: true },
            { name: 'Capacity', value: `${agreement.capacity} MW`, inline: true },
            { name: 'Duration', value: `${agreement.duration} hours`, inline: true },
            { name: 'Rate', value: `${agreement.rate} resources/hour`, inline: true },
            { name: 'Resources', value: `Metal: ${agreement.metal}\nCrystal: ${agreement.crystal}\nDeuterium: ${agreement.deuterium}`, inline: false }
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