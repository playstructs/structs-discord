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
                            { name: 'Fleet', value: 'fleet' },
                            { name: 'Planetary', value: 'planet' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('ambit')
                        .setDescription('Operating ambit of the structure')
                        .setRequired(true)
                        .addChoices(
                            { name: `Space`, value: '16' },
                            { name: `Air`, value: '8' },
                            { name: `Land`, value: '4' },
                            { name: `Water`, value: '2' }
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
                ))
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
            ))
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
            ))
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
            ))
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
            ))
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
            ))
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
            ))
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
            ))
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
            ))
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
            ))
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
                                struct_type.id as value 
                         FROM structs.struct_type 
                         WHERE struct_type.category = lower($1) 
                         AND  (possible_ambit & $2) > 0
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
                                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon, 
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
        await interaction.deferReply({ ephemeral: true });
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

                const embed = new EmbedBuilder()
                    .setTitle('Structure Definition Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your structure definition has been submitted for processing.')
                    .addFields(
                        { name: 'Category', value: category, inline: true },
                        { name: 'Ambit', value: ambit, inline: true },
                        { name: 'Slot', value: slot.toString(), inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure definition transaction
                await db.query(
                    'SELECT signer.tx_struct_build_initiate($1, $2, $3, $4)',
                    [playerId, parseInt(structType), ambit, slot]
                );
            } else if (subcommand === 'build') {
                
                const structId = interaction.options.getString('struct');

                const playerResult = await db.query(
                    "select struct_attribute.val as build_start_block from struct_attribute where attribute_type = 'blockStartBuild' and object_id = $1",
                    [structId]
                );
                
                const nonce = interaction.options.getInteger('nonce');
                const buildStartBlock = playerResult.rows[0].build_start_block;

                // performingStructure.Id + "BUILD" + buildStartBlockString + "NONCE" + strconv.Itoa(i)
                const proofBase = structId + "BUILD" + buildStartBlock.toString() + "NONCE" + nonce.toString();

                // Generate SHA-256 hash of the nonce
                const proof = crypto.createHash('sha256')
                    .update(proofBase)
                    .digest('hex');


                const embed = new EmbedBuilder()
                    .setTitle('Structure Build Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your structure build request has been submitted for processing.')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true },
                        { name: 'Nonce', value: nonce.toString(), inline: true },
                        { name: 'Proof', value: proof, inline: true },
                        { name: 'Build Start Block', value: buildStartBlock.toString(), inline: true },
                        { name: 'Proof Base', value: proofBase, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure build completion transaction
                await db.query(
                    'SELECT signer.tx_struct_build_complete($1, $2, $3, $4)',
                    [playerId, structId, proof, nonce]
                );
            } else if (subcommand === 'activate') {
                const structId = interaction.options.getString('struct');

                const embed = new EmbedBuilder()
                    .setTitle('Structure Activation Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your structure activation request has been submitted for processing.')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure activation transaction
                await db.query(
                    'SELECT signer.tx_struct_activate($1, $2)',
                    [playerId, structId]
                );
            } else if (subcommand === 'deactivate') {
                const structId = interaction.options.getString('struct');

                const embed = new EmbedBuilder()
                    .setTitle('Structure Deactivation Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your structure deactivation request has been submitted for processing.')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure deactivation transaction
                await db.query(
                    'SELECT signer.tx_struct_deactivate($1, $2)',
                    [playerId, structId]
                );
            } else if (subcommand === 'mine') {
                const structId = interaction.options.getString('struct');
                const nonce = interaction.options.getInteger('nonce');


                const playerResult = await db.query(
                    "select struct_attribute.val as mine_start_block from struct_attribute where attribute_type = 'blockStartOreMine' and object_id = $1",
                    [structId]
                );

                const mineStartBlock = playerResult.rows[0].mine_start_block;

                const proofBase = structId + "MINE" + mineStartBlock.toString() + "NONCE" + nonce.toString(); 

                // Generate SHA-256 hash of the nonce
                const proof = crypto.createHash('sha256')
                    .update(proofBase)
                    .digest('hex');

                const embed = new EmbedBuilder()
                    .setTitle('Mining Request Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your mining request has been submitted for processing.')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true },
                        { name: 'Nonce', value: nonce.toString(), inline: true },
                        { name: 'Proof', value: proof, inline: true },
                        { name: 'Mine Start Block', value: mineStartBlock.toString(), inline: true },
                        { name: 'Proof Base', value: proofBase, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure mining transaction
                await db.query(
                    'SELECT signer.tx_struct_ore_mine_complete($1, $2, $3, $4)',
                    [playerId, structId, proof, nonce]
                );
            } else if (subcommand === 'refine') {
                const structId = interaction.options.getString('struct');
                const nonce = interaction.options.getInteger('nonce');

                const playerResult = await db.query(
                    "select struct_attribute.val as refine_start_block from struct_attribute where attribute_type = 'blockStartOreRefine' and object_id = $1",
                    [structId]
                );

                const refineStartBlock = playerResult.rows[0].refine_start_block;

                const proofBase = structId + "REFINE" + refineStartBlock.toString() + "NONCE" + nonce.toString(); 

                // Generate SHA-256 hash of the nonce
                const proof = crypto.createHash('sha256')
                    .update(proofBase)
                    .digest('hex');

                const embed = new EmbedBuilder()
                    .setTitle('Refining Request Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your refining request has been submitted for processing.')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true },
                        { name: 'Nonce', value: nonce.toString(), inline: true },
                        { name: 'Proof', value: proof, inline: true },
                        { name: 'Refine Start Block', value: refineStartBlock.toString(), inline: true },
                        { name: 'Proof Base', value: proofBase, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure refining transaction
                await db.query(
                    'SELECT signer.tx_struct_ore_refine_complete($1, $2, $3, $4)',
                    [playerId, structId, proof, nonce]
                );
            } else if (subcommand === 'attack') {
                const attackerStructId = interaction.options.getString('attacker_struct');
                const targetStructId = interaction.options.getString('target_struct');
                const weaponSystem = interaction.options.getString('weapon_system');

                const embed = new EmbedBuilder()
                    .setTitle('Attack Request Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your attack request has been submitted for processing.')
                    .addFields(
                        { name: 'Attacker Structure', value: attackerStructId, inline: true },
                        { name: 'Target Structure', value: targetStructId, inline: true },
                        { name: 'Weapon System', value: weaponSystem, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure attack transaction
                await db.query(
                    'SELECT signer.tx_struct_attack($1, $2, $3, $4)',
                    [playerId, attackerStructId, targetStructId, weaponSystem]
                );
            } else if (subcommand === 'defense-clear') {
                const defenderStructId = interaction.options.getString('defender_struct');

                const embed = new EmbedBuilder()
                    .setTitle('Defense Clear Request Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your defense clear request has been submitted for processing.')
                    .addFields(
                        { name: 'Structure ID', value: defenderStructId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure defense clear transaction
                await db.query(
                    'SELECT signer.tx_struct_defense_clear($1, $2)',
                    [playerId, defenderStructId]
                );
            } else if (subcommand === 'defense-set') {
                const defenderStructId = interaction.options.getString('defender_struct');
                const protectedStructId = interaction.options.getString('protected_struct');

                const embed = new EmbedBuilder()
                    .setTitle('Defense Set Request Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your defense set request has been submitted for processing.')
                    .addFields(
                        { name: 'Defender Structure', value: defenderStructId, inline: true },
                        { name: 'Protected Structure', value: protectedStructId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure defense set transaction
                await db.query(
                    'SELECT signer.tx_struct_defense_set($1, $2, $3)',
                    [playerId, defenderStructId, protectedStructId]
                );
            } else if (subcommand === 'stealth-activate') {
                const structId = interaction.options.getString('struct');

                const embed = new EmbedBuilder()
                    .setTitle('Stealth Activation Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your stealth activation request has been submitted for processing.')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure stealth activation transaction
                await db.query(
                    'SELECT signer.tx_struct_stealth_activate($1, $2)',
                    [playerId, structId]
                );
            } else if (subcommand === 'stealth-deactivate') {
                const structId = interaction.options.getString('struct');

                const embed = new EmbedBuilder()
                    .setTitle('Stealth Deactivation Submitted')
                    .setColor('#00ff00')
                    .setDescription('Your stealth deactivation request has been submitted for processing.')
                    .addFields(
                        { name: 'Structure ID', value: structId, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

                // Execute the structure stealth deactivation transaction
                await db.query(
                    'SELECT signer.tx_struct_stealth_deactivate($1, $2)',
                    [playerId, structId]
                );
            }
        } catch (error) {
            console.error('Error executing struct command:', error);
            await interaction.editReply(`${EMOJIS.STATUS.ERROR} An error occurred while processing your struct request.`);
        }
    }
}; 