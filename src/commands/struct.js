const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');
const crypto = require('crypto');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('struct')
        .setDescription('Manage structures in the game')
        .addSubcommand(subcommand =>
            subcommand
                .setName('define')
                .setDescription('Define a new structure')
                .addStringOption(option =>
                    option
                        .setName('category')
                        .setDescription('Category of the structure')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Fleet', value: 'Fleet' },
                            { name: 'Planetary', value: 'Planetary' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('ambit')
                        .setDescription('Operating ambit of the structure')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Space', value: '16' },
                            { name: 'Air', value: '8' },
                            { name: 'Land', value: '4' },
                            { name: 'Water', value: '2' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('struct_type')
                        .setDescription('Type of structure to define')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('slot')
                        .setDescription('Slot number for the structure')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10)
                )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('build')
            .setDescription('Complete the construction of a structure')
            .addStringOption(option =>
                option
                    .setName('struct')
                    .setDescription('Select a structure to build')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addIntegerOption(option =>
                option
                    .setName('nonce')
                    .setDescription('Nonce value for the build proof')
                    .setRequired(true)
                    .setMinValue(1)
            )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('activate')
            .setDescription('Activate a built structure')
            .addStringOption(option =>
                option
                    .setName('struct')
                    .setDescription('Select a structure to activate')
                    .setRequired(true)
                    .setAutocomplete(true)
            )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('deactivate')
            .setDescription('Deactivate an active structure')
            .addStringOption(option =>
                option
                    .setName('struct')
                    .setDescription('Select a structure to deactivate')
                    .setRequired(true)
                    .setAutocomplete(true)
            )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('mine')
            .setDescription('Mine resources from a structure')
            .addStringOption(option =>
                option
                    .setName('struct')
                    .setDescription('Select a structure to mine from')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addIntegerOption(option =>
                option
                    .setName('nonce')
                    .setDescription('Nonce value for the mining proof')
                    .setRequired(true)
                    .setMinValue(1)
            )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('refine')
            .setDescription('Refine resources in a structure')
            .addStringOption(option =>
                option
                    .setName('struct')
                    .setDescription('Select a structure to refine in')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addIntegerOption(option =>
                option
                    .setName('nonce')
                    .setDescription('Nonce value for the refining proof')
                    .setRequired(true)
                    .setMinValue(1)
            )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('attack')
            .setDescription('Attack a target structure')
            .addStringOption(option =>
                option
                    .setName('attacker_struct')
                    .setDescription('Select your attacking structure')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption(option =>
                option
                    .setName('target_struct')
                    .setDescription('Select the target structure')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption(option =>
                option
                    .setName('weapon_system')
                    .setDescription('Select the weapon system to use')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Primary Weapon', value: 'primary-weapon' },
                        { name: 'Secondary Weapon', value: 'secondary-weapon' }
                    )
            )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('defense-clear')
            .setDescription('Clear defense systems of a structure')
            .addStringOption(option =>
                option
                    .setName('defender_struct')
                    .setDescription('Select the structure to clear defenses')
                    .setRequired(true)
                    .setAutocomplete(true)
            )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('defense-set')
            .setDescription('Set a structure to protect another structure')
            .addStringOption(option =>
                option
                    .setName('defender_struct')
                    .setDescription('Select the defending structure')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption(option =>
                option
                    .setName('protected_struct')
                    .setDescription('Select the structure to protect')
                    .setRequired(true)
                    .setAutocomplete(true)
            )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('stealth-activate')
            .setDescription('Activate stealth systems on a structure')
            .addStringOption(option =>
                option
                    .setName('struct')
                    .setDescription('Select the structure to activate stealth on')
                    .setRequired(true)
                    .setAutocomplete(true)
            )),

    .addSubcommand(subcommand =>
        subcommand
            .setName('stealth-deactivate')
            .setDescription('Deactivate stealth systems on a structure')
            .addStringOption(option =>
                option
                    .setName('struct')
                    .setDescription('Select the structure to deactivate stealth on')
                    .setRequired(true)
                    .setAutocomplete(true)
            )),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const focusedOption = interaction.options.getFocused(true);
        const subcommand = interaction.options.getSubcommand();

        try {
            // Get player ID from Discord username
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return;
            }

            const playerId = playerResult.rows[0].player_id;

            if (subcommand === 'define') {
                if (focusedOption.name === 'struct_type') {
                    const category = interaction.options.getString('category');
                    const ambit = interaction.options.getString('ambit');

                    const result = await db.query(
                        `SELECT struct_type.type as name, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct_type.id as value 
                         FROM structs.struct_type 
                         WHERE struct_type.category = $1 
                         AND possible_ambit = $2
                         AND struct_type.type ILIKE $3
                         LIMIT 25`,
                        [category, parseInt(ambit), `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const emojiKey = row.icon;
                        const emoji = EMOJIS[emojiKey] || '🏗️'; // Default emoji if not found
                        return {
                            name: `${emoji} ${row.name}`,
                            value: row.value.toString()
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'build') {
                if (focusedOption.name === 'struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 2) = 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'activate') {
                if (focusedOption.name === 'struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 2) > 0
                         )
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 4) = 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'deactivate') {
                if (focusedOption.name === 'struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 2) > 0
                         )
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 4) > 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'mine') {
                if (focusedOption.name === 'struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct_type.planetary_mining != 'noPlanetaryMining'
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 4) > 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'refine') {
                if (focusedOption.name === 'struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct_type.planetary_refinery != 'noPlanetaryRefinery'
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 4) > 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'attack') {
                if (focusedOption.name === 'attacker_struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct_type.primary_weapon != 'noActiveWeaponry'
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 4) > 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                } else if (focusedOption.name === 'target_struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND (struct.id || ' ' || struct_type.type) ILIKE $1
                         LIMIT 25`,
                        [`%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'defense-clear') {
                if (focusedOption.name === 'defender_struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 4) > 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'defense-set') {
                if (focusedOption.name === 'defender_struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 4) > 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                } else if (focusedOption.name === 'protected_struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct.owner = $1 
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'stealth-activate') {
                if (focusedOption.name === 'struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct_type.stealth_systems 
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 4) > 0
                         )
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 16) = 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            } else if (subcommand === 'stealth-deactivate') {
                if (focusedOption.name === 'struct') {
                    const result = await db.query(
                        `SELECT struct.id || ' ' || struct_type.type as name, 
                                struct.operating_ambit as ambit, 
                                UPPER(REPLACE(struct_type.type, ' ', '_')) as icon, 
                                struct.id as value
                         FROM structs.struct, structs.struct_type 
                         WHERE struct.type = struct_type.id 
                         AND struct_type.stealth_systems 
                         AND struct.owner = $1 
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 4) > 0
                         )
                         AND struct.id IN (
                             SELECT struct_attribute.object_id 
                             FROM structs.struct_attribute 
                             WHERE (struct_attribute.val & 16) > 0
                         )
                         AND (struct.id || ' ' || struct_type.type) ILIKE $2
                         LIMIT 25`,
                        [playerId, `%${focusedValue}%`]
                    );

                    const choices = result.rows.map(row => {
                        const typeEmojiKey = row.icon;
                        const typeEmoji = EMOJIS[typeEmojiKey] || '🏗️';
                        
                        const ambitEmojiKey = `RANGE_${row.ambit}`;
                        const ambitEmoji = EMOJIS[ambitEmojiKey] || '🌍';
                        
                        return {
                            name: `${typeEmoji} ${row.name} ${ambitEmoji}`,
                            value: row.value
                        };
                    });

                    await interaction.respond(choices);
                }
            }
        } catch (error) {
            console.error('Error in struct autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        try {
            // Get player ID from Discord username
            const playerResult = await db.query(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                [interaction.user.id]
            );

            if (playerResult.rows.length === 0) {
                return await interaction.editReply('You are not registered as a player. Please join a guild first.');
            }

            const playerId = playerResult.rows[0].player_id;

            if (subcommand === 'define') {
                const category = interaction.options.getString('category');
                const ambit = interaction.options.getString('ambit');
                const structType = interaction.options.getString('struct_type');
                const slot = interaction.options.getInteger('slot');

                // Execute the structure definition transaction
                await db.query(
                    'SELECT signer.tx_struct_build_initiate($1, $2, $3, $4)',
                    [playerId, parseInt(structType), ambit, slot]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Structure Defined')
                    .setColor('#00ff00')
                    .setDescription('You have successfully defined a new structure!')
                    .addFields(
                        { name: 'Category', value: category, inline: true },
                        { name: 'Ambit', value: ambit, inline: true },
                        { name: 'Slot', value: slot.toString(), inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'build') {
                const structId = interaction.options.getString('struct');
                const nonce = interaction.options.getInteger('nonce');

                // Generate SHA-256 hash of the nonce
                const proof = crypto.createHash('sha256')
                    .update(nonce.toString())
                    .digest('hex');

                // Execute the structure build completion transaction
                await db.query(
                    'SELECT signer.tx_struct_build_complete($1, $2, $3, $4)',
                    [playerId, structId, proof, nonce]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Structure Built')
                    .setColor('#00ff00')
                    .setDescription('You have successfully completed the construction of your structure!')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true },
                        { name: 'Nonce', value: nonce.toString(), inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'activate') {
                const structId = interaction.options.getString('struct');

                // Execute the structure activation transaction
                await db.query(
                    'SELECT signer.tx_struct_activate($1, $2)',
                    [playerId, structId]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Structure Activated')
                    .setColor('#00ff00')
                    .setDescription('You have successfully activated your structure!')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'deactivate') {
                const structId = interaction.options.getString('struct');

                // Execute the structure deactivation transaction
                await db.query(
                    'SELECT signer.tx_struct_deactivate($1, $2)',
                    [playerId, structId]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Structure Deactivated')
                    .setColor('#00ff00')
                    .setDescription('You have successfully deactivated your structure!')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'mine') {
                const structId = interaction.options.getString('struct');
                const nonce = interaction.options.getInteger('nonce');

                // Generate SHA-256 hash of the nonce
                const proof = crypto.createHash('sha256')
                    .update(nonce.toString())
                    .digest('hex');

                // Execute the structure mining transaction
                await db.query(
                    'SELECT signer.tx_struct_ore_mine_complete($1, $2, $3, $4)',
                    [playerId, structId, proof, nonce]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Mining Complete')
                    .setColor('#00ff00')
                    .setDescription('You have successfully mined resources from your structure!')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true },
                        { name: 'Nonce', value: nonce.toString(), inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'refine') {
                const structId = interaction.options.getString('struct');
                const nonce = interaction.options.getInteger('nonce');

                // Generate SHA-256 hash of the nonce
                const proof = crypto.createHash('sha256')
                    .update(nonce.toString())
                    .digest('hex');

                // Execute the structure refining transaction
                await db.query(
                    'SELECT signer.tx_struct_ore_refine_complete($1, $2, $3, $4)',
                    [playerId, structId, proof, nonce]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Refining Complete')
                    .setColor('#00ff00')
                    .setDescription('You have successfully refined resources in your structure!')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true },
                        { name: 'Nonce', value: nonce.toString(), inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'attack') {
                const attackerStructId = interaction.options.getString('attacker_struct');
                const targetStructId = interaction.options.getString('target_struct');
                const weaponSystem = interaction.options.getString('weapon_system');

                // Execute the structure attack transaction
                await db.query(
                    'SELECT signer.tx_struct_attack($1, $2, $3, $4)',
                    [playerId, attackerStructId, targetStructId, weaponSystem]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Attack Launched')
                    .setColor('#00ff00')
                    .setDescription('You have successfully launched an attack!')
                    .addFields(
                        { name: 'Attacker Structure', value: attackerStructId, inline: true },
                        { name: 'Target Structure', value: targetStructId, inline: true },
                        { name: 'Weapon System', value: weaponSystem, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'defense-clear') {
                const defenderStructId = interaction.options.getString('defender_struct');

                // Execute the structure defense clear transaction
                await db.query(
                    'SELECT signer.tx_struct_defense_clear($1, $2)',
                    [playerId, defenderStructId]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Defense Systems Cleared')
                    .setColor('#00ff00')
                    .setDescription('You have successfully cleared the defense systems of your structure!')
                    .addFields(
                        { name: 'Structure ID', value: defenderStructId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'defense-set') {
                const defenderStructId = interaction.options.getString('defender_struct');
                const protectedStructId = interaction.options.getString('protected_struct');

                // Execute the structure defense set transaction
                await db.query(
                    'SELECT signer.tx_struct_defense_set($1, $2, $3)',
                    [playerId, defenderStructId, protectedStructId]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Defense System Set')
                    .setColor('#00ff00')
                    .setDescription('You have successfully set up a defense system!')
                    .addFields(
                        { name: 'Defender Structure', value: defenderStructId, inline: true },
                        { name: 'Protected Structure', value: protectedStructId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'stealth-activate') {
                const structId = interaction.options.getString('struct');

                // Execute the structure stealth activation transaction
                await db.query(
                    'SELECT signer.tx_struct_stealth_activate($1, $2)',
                    [playerId, structId]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Stealth Systems Activated')
                    .setColor('#00ff00')
                    .setDescription('You have successfully activated stealth systems on your structure!')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'stealth-deactivate') {
                const structId = interaction.options.getString('struct');

                // Execute the structure stealth deactivation transaction
                await db.query(
                    'SELECT signer.tx_struct_stealth_deactivate($1, $2)',
                    [playerId, structId]
                );

                const embed = new EmbedBuilder()
                    .setTitle('Stealth Systems Deactivated')
                    .setColor('#00ff00')
                    .setDescription('You have successfully deactivated stealth systems on your structure!')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error in struct command:', error);
            await interaction.editReply('An error occurred while processing your request.');
        }
    }
}; 