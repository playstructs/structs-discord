const { SlashCommandBuilder } = require('@discordjs/builders');
const { fetchPlayerData, fetchGuildData, fetchStructData } = require('../queries/structs');
const { createEmbeds } = require('../embeds/structs');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('structs')
        .setDescription('Look up information about various game entities')
        .addSubcommand(subcommand =>
            subcommand
                .setName('lookup')
                .setDescription('Look up information about a game entity')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The ID to look up')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('address')
                .setDescription('Look up information about a player by their address')
                .addStringOption(option =>
                    option
                        .setName('address')
                        .setDescription('The player\'s address')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('discord')
                .setDescription('Look up information about a player by their Discord username')
                .addStringOption(option =>
                    option
                        .setName('username')
                        .setDescription('The player\'s Discord username')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('guild')
                .setDescription('Look up information about a guild by its tag')
                .addStringOption(option =>
                    option
                        .setName('tag')
                        .setDescription('The guild\'s tag')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join a guild')
                .addStringOption(option =>
                    option
                        .setName('guild')
                        .setDescription('The guild to join')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'lookup': {
                    const id = interaction.options.getString('id');
                    const result = await handleIdLookup(id);
                    await interaction.editReply(result);
                    break;
                }
                case 'address': {
                    const address = interaction.options.getString('address');
                    const result = await handleAddressLookup(address);
                    await interaction.editReply(result);
                    break;
                }
                case 'discord': {
                    const username = interaction.options.getString('username');
                    const result = await handleDiscordLookup(username);
                    await interaction.editReply(result);
                    break;
                }
                case 'guild': {
                    const tag = interaction.options.getString('tag');
                    const result = await handleTagLookup(tag);
                    await interaction.editReply(result);
                    break;
                }
                case 'join': {
                    const guildId = interaction.options.getString('guild');
                    const result = await handleJoinGuild(interaction.user.username, guildId);
                    await interaction.editReply(result);
                    break;
                }
            }
        } catch (error) {
            console.error('Error executing structs command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        
        if (interaction.options.getSubcommand() === 'join') {
            try {
                const result = await db.query(
                    `SELECT id, name 
                     FROM structs.guild_meta 
                     WHERE name ILIKE $1 
                     LIMIT 25`,
                    [`%${focusedValue}%`]
                );

                await interaction.respond(
                    result.rows.map(row => ({
                        name: row.name,
                        value: row.id
                    }))
                );
            } catch (error) {
                console.error('Error fetching guild autocomplete:', error);
            }
        }
    }
};

async function handleIdLookup(id) {
    // Parse the ID format (type-index)
    const [type, index] = id.split('-').map(Number);
    
    // Validate the ID format
    if (isNaN(type) || isNaN(index)) {
        return 'Invalid ID format. Expected format: <type>-<index>';
    }

    let data;
    let embeds;

    // Use the type to determine which query to run
    switch (type) {
        case 0: // Guild
            data = await fetchGuildData.byId(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.guild(data.rows[0]);
                return { embeds };
            }
            break;

        case 1: // Player
            data = await fetchPlayerData.byId(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.player(data.rows[0]);
                return { embeds };
            }
            break;

        case 2: // Planet
            data = await fetchStructData.planet(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.planet(data.rows[0]);
                return { embeds };
            }
            break;

        case 3: // Reactor
            data = await fetchStructData.reactor(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.reactor(data.rows[0]);
                return { embeds };
            }
            break;

        case 4: // Substation
            data = await fetchStructData.substation(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.substation(data.rows[0]);
                return { embeds };
            }
            break;

        case 5: // Struct
            data = await fetchStructData.struct(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.struct(data.rows[0]);
                return { embeds };
            }
            break;

        case 6: // Allocation
            data = await fetchStructData.allocation(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.allocation(data.rows[0]);
                return { embeds };
            }
            break;

        case 7: // Infusion
            return 'Infusion lookup not implemented';
            break;

        case 8: // Address
            return 'Address lookup not implemented';
            break;

        case 9: // Fleet
            data = await fetchStructData.fleet(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.fleet(data.rows[0]);
                return { embeds };
            }
            break;

        case 10: // Provider
            data = await fetchStructData.provider(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.provider(data.rows[0]);
                return { embeds };
            }
            break;

        case 11: // Agreement
            data = await fetchStructData.agreement(id);
            if (data.rows.length > 0) {
                embeds = await createEmbeds.agreement(data.rows[0]);
                return { embeds };
            }
            break;

        default:
            return 'Invalid type in ID. Type must be between 0 and 11.';
    }

    return 'No entity found with that ID.';
}

async function handleAddressLookup(address) {
    const data = await fetchPlayerData.byAddress(address);
    if (data.rows.length > 0) {
        const embeds = await createEmbeds.player(data.rows[0]);
        return { embeds };
    }
    return 'No player found with that address.';
}

async function handleDiscordLookup(username) {
    const data = await fetchPlayerData.byDiscordId(username);
    if (data.rows.length > 0) {
        const embeds = await createEmbeds.player(data.rows[0]);
        return { embeds };
    }
    return 'No player found with that Discord username.';
}

async function handleTagLookup(tag) {
    const data = await fetchGuildData.byTag(tag);
    if (data.rows.length > 0) {
        const embeds = await createEmbeds.guild(data.rows[0]);
        return { embeds };
    }
    return 'No guild found with that tag.';
}

async function handleJoinGuild(discordUsername, guildId) {
    try {
        // Check if player already exists
        const playerCheck = await db.query(
            'SELECT * FROM structs.player_meta WHERE username = $1',
            [discordUsername]
        );

        if (playerCheck.rows.length > 0) {
            return 'You are already registered as a player.';
        }

        // Check if player already has a pending join request
        const pendingCheck = await db.query(
            'SELECT * FROM structs.player_internal_pending WHERE discord_username = $1',
            [discordUsername]
        );

        if (pendingCheck.rows.length > 0) {
            return 'You already have a pending join request. Please wait for it to be processed.';
        }

        // Insert the join request
        await db.query(
            'INSERT INTO structs.player_internal_pending (guild_id, discord_username) VALUES ($1, $2)',
            [guildId, discordUsername]
        );

        return 'Your join request has been submitted. The backend process will handle your registration. You will be able to use more commands once your registration is complete.';
    } catch (error) {
        console.error('Error handling guild join:', error);
        return 'An error occurred while processing your join request.';
    }
} 