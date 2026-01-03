const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createSuccessEmbed, createWarningEmbed } = require('../utils/errors');
const { getPlayerId, getPlayerIdWithValidation } = require('../utils/player');
const { formatStructChoice, getStructAttribute } = require('../utils/structs');
const crypto = require('crypto');

/**
 * Structure management command module
 * @module commands/struct
 * @description Comprehensive command for managing structures including define, build, activate, mine, refine, attack, defense, and stealth operations
 */
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

    /**
     * Autocomplete handler for struct command
     * @param {Object} interaction - Discord autocomplete interaction
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getFocused - Get focused option value
     * @param {Function} interaction.options.getFocused - Get focused option with name
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand
     * @param {Function} interaction.options.getString - Get string option value
     * @param {Function} interaction.respond - Respond with autocomplete choices
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const focusedOption = interaction.options.getFocused(true);
        const subcommand = interaction.options.getSubcommand();

        try {
            // Get player ID from Discord ID
            const playerId = await getPlayerId(interaction.user.id);
            if (!playerId) {
                return;
            }

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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
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

                    const choices = result.rows.map(formatStructChoice);
                    await interaction.respond(choices);
                }
            }
        } catch (error) {
            console.error('Error in struct autocomplete:', error);
            await interaction.respond([]);
        }
    },

    /**
     * Execute handler for struct command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand
     * @param {Function} interaction.options.getString - Get string option value
     * @param {Function} interaction.options.getInteger - Get integer option value
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        try {
            // Get player ID with validation
            const playerResult = await getPlayerIdWithValidation(
                interaction.user.id,
                'You are not registered as a player. Please use `/join` to join a guild first.'
            );
            
            if (playerResult.error) {
                return await interaction.editReply({ embeds: [playerResult.error] });
            }

            const playerId = playerResult.playerId;

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

                const embed = createSuccessEmbed(
                    'Structure Definition Submitted',
                    'Your structure definition has been submitted for processing.',
                    [
                        { name: 'Category', value: category, inline: true },
                        { name: 'Ambit', value: ambit, inline: true },
                        { name: 'Slot', value: slot.toString(), inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'build') {
                const structId = interaction.options.getString('struct');
                const nonce = interaction.options.getInteger('nonce');

                const buildStartBlock = await getStructAttribute(structId, 'blockStartBuild');
                if (buildStartBlock === null) {
                    return await interaction.editReply({
                        embeds: [createWarningEmbed(
                            'Build Data Not Found',
                            'This structure does not have build data. It may not be ready to build yet.'
                        )]
                    });
                }

                // performingStructure.Id + "BUILD" + buildStartBlockString + "NONCE" + strconv.Itoa(i)
                const proofBase = structId + "BUILD" + buildStartBlock.toString() + "NONCE" + nonce;

                // Generate SHA-256 hash of the nonce
                const proof = crypto.createHash('sha256')
                    .update(proofBase)
                    .digest('hex');


                // Execute the structure build completion transaction
                await db.query(
                    'SELECT signer.tx_struct_build_complete($1, $2, $3, $4)',
                    [playerId, structId, proof, nonce]
                );

                const embed = createSuccessEmbed(
                    'Structure Build Submitted',
                    'Your structure build request has been submitted for processing.',
                    [
                        { name: 'Structure ID', value: structId, inline: true },
                        { name: 'Nonce', value: nonce.toString(), inline: true },
                        { name: 'Proof', value: proof.substring(0, 16) + '...', inline: false },
                        { name: 'Build Start Block', value: buildStartBlock.toString(), inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'activate') {
                const structId = interaction.options.getString('struct');

                // Execute the structure activation transaction
                await db.query(
                    'SELECT signer.tx_struct_activate($1, $2)',
                    [playerId, structId]
                );

                const embed = createSuccessEmbed(
                    'Structure Activation Submitted',
                    'Your structure activation request has been submitted for processing.',
                    [
                        { name: 'Structure ID', value: structId, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'deactivate') {
                const structId = interaction.options.getString('struct');

                // Execute the structure deactivation transaction
                await db.query(
                    'SELECT signer.tx_struct_deactivate($1, $2)',
                    [playerId, structId]
                );

                const embed = createSuccessEmbed(
                    'Structure Deactivation Submitted',
                    'Your structure deactivation request has been submitted for processing.',
                    [
                        { name: 'Structure ID', value: structId, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'mine') {
                const structId = interaction.options.getString('struct');
                const nonce = interaction.options.getInteger('nonce');

                const mineStartBlock = await getStructAttribute(structId, 'blockStartOreMine');
                if (mineStartBlock === null) {
                    return await interaction.editReply({
                        embeds: [createWarningEmbed(
                            'Mining Data Not Found',
                            'This structure does not have mining data. Mining may not have started yet.'
                        )]
                    });
                }

                const proofBase = structId + "MINE" + mineStartBlock.toString() + "NONCE" + nonce; 

                // Generate SHA-256 hash of the nonce
                const proof = crypto.createHash('sha256')
                    .update(proofBase)
                    .digest('hex');

                // Execute the structure mining transaction
                await db.query(
                    'SELECT signer.tx_struct_ore_mine_complete($1, $2, $3, $4)',
                    [playerId, structId, proof, nonce]
                );

                const embed = createSuccessEmbed(
                    'Mining Request Submitted',
                    'Your mining request has been submitted for processing.',
                    [
                        { name: 'Structure ID', value: structId, inline: true },
                        { name: 'Nonce', value: nonce.toString(), inline: true },
                        { name: 'Proof', value: proof.substring(0, 16) + '...', inline: false },
                        { name: 'Mine Start Block', value: mineStartBlock.toString(), inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'refine') {
                const structId = interaction.options.getString('struct');
                const nonce = interaction.options.getInteger('nonce');

                const refineStartBlock = await getStructAttribute(structId, 'blockStartOreRefine');
                if (refineStartBlock === null) {
                    return await interaction.editReply({
                        embeds: [createWarningEmbed(
                            'Refining Data Not Found',
                            'This structure does not have refining data. Refining may not have started yet.'
                        )]
                    });
                }

                const proofBase = structId + "REFINE" + refineStartBlock.toString() + "NONCE" + nonce; 

                // Generate SHA-256 hash of the nonce
                const proof = crypto.createHash('sha256')
                    .update(proofBase)
                    .digest('hex');

                // Execute the structure refining transaction
                await db.query(
                    'SELECT signer.tx_struct_ore_refine_complete($1, $2, $3, $4)',
                    [playerId, structId, proof, nonce]
                );

                const embed = createSuccessEmbed(
                    'Refining Request Submitted',
                    'Your refining request has been submitted for processing.',
                    [
                        { name: 'Structure ID', value: structId, inline: true },
                        { name: 'Nonce', value: nonce.toString(), inline: true },
                        { name: 'Proof', value: proof.substring(0, 16) + '...', inline: false },
                        { name: 'Refine Start Block', value: refineStartBlock.toString(), inline: true }
                    ]
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

                const embed = createSuccessEmbed(
                    'Attack Request Submitted',
                    'Your attack request has been submitted for processing.',
                    [
                        { name: 'Attacker Structure', value: attackerStructId, inline: true },
                        { name: 'Target Structure', value: targetStructId, inline: true },
                        { name: 'Weapon System', value: weaponSystem, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'defense-clear') {
                const defenderStructId = interaction.options.getString('defender_struct');

                // Execute the structure defense clear transaction
                await db.query(
                    'SELECT signer.tx_struct_defense_clear($1, $2)',
                    [playerId, defenderStructId]
                );

                const embed = createSuccessEmbed(
                    'Defense Clear Request Submitted',
                    'Your defense clear request has been submitted for processing.',
                    [
                        { name: 'Structure ID', value: defenderStructId, inline: true }
                    ]
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

                const embed = createSuccessEmbed(
                    'Defense Set Request Submitted',
                    'Your defense set request has been submitted for processing.',
                    [
                        { name: 'Defender Structure', value: defenderStructId, inline: true },
                        { name: 'Protected Structure', value: protectedStructId, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'stealth-activate') {
                const structId = interaction.options.getString('struct');

                // Execute the structure stealth activation transaction
                await db.query(
                    'SELECT signer.tx_struct_stealth_activate($1, $2)',
                    [playerId, structId]
                );

                const embed = createSuccessEmbed(
                    'Stealth Activation Submitted',
                    'Your stealth activation request has been submitted for processing.',
                    [
                        { name: 'Structure ID', value: structId, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'stealth-deactivate') {
                const structId = interaction.options.getString('struct');

                // Execute the structure stealth deactivation transaction
                await db.query(
                    'SELECT signer.tx_struct_stealth_deactivate($1, $2)',
                    [playerId, structId]
                );

                const embed = createSuccessEmbed(
                    'Stealth Deactivation Submitted',
                    'Your stealth deactivation request has been submitted for processing.',
                    [
                        { name: 'Structure ID', value: structId, inline: true }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            const { embed } = handleError(error, 'struct command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}; 