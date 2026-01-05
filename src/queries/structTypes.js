const db = require('../database');

/**
 * Fetch struct type data for cheatsheet generation
 * @module queries/structTypes
 */

const fetchStructTypeData = {
    /**
     * Get struct type by ID with all necessary fields for cheatsheet
     * @param {string|number} structTypeId - Struct type ID
     * @returns {Promise<Object|null>} Struct type data or null if not found
     */
    async byId(structTypeId) {
        const result = await db.query(
            `SELECT 
                struct_type.id,
                struct_type.type,
                struct_type.class,
                struct_type.category,
                struct_type.default_cosmetic_model_number,
                struct_type.build_charge,
                struct_type.build_draw,
                struct_type.build_difficulty,
                struct_type.max_health,
                struct_type.passive_draw,
                struct_type.possible_ambit,
                
                -- Primary weapon
                struct_type.primary_weapon,
                struct_type.primary_weapon_label,
                struct_type.primary_weapon_description,
                struct_type.primary_weapon_class,
                struct_type.primary_weapon_control,
                struct_type.primary_weapon_charge,
                struct_type.primary_weapon_ambits,
                struct_type.primary_weapon_ambits_array,
                struct_type.primary_weapon_targets,
                struct_type.primary_weapon_shots,
                struct_type.primary_weapon_damage,
                struct_type.primary_weapon_blockable,
                struct_type.primary_weapon_counterable,
                struct_type.primary_weapon_recoil_damage,
                struct_type.primary_weapon_shot_success_rate_numerator,
                struct_type.primary_weapon_shot_success_rate_denominator,
                
                -- Secondary weapon
                struct_type.secondary_weapon,
                struct_type.secondary_weapon_label,
                struct_type.secondary_weapon_class,
                struct_type.secondary_weapon_control,
                struct_type.secondary_weapon_charge,
                struct_type.secondary_weapon_ambits,
                struct_type.secondary_weapon_ambits_array,
                struct_type.secondary_weapon_targets,
                struct_type.secondary_weapon_shots,
                struct_type.secondary_weapon_damage,
                struct_type.secondary_weapon_blockable,
                struct_type.secondary_weapon_counterable,
                struct_type.secondary_weapon_recoil_damage,
                struct_type.secondary_weapon_shot_success_rate_numerator,
                struct_type.secondary_weapon_shot_success_rate_denominator,
                
                -- Passive weaponry
                struct_type.passive_weaponry,
                struct_type.passive_weaponry_label,
                struct_type.passive_weaponry_description,
                
                -- Defenses
                struct_type.unit_defenses,
                struct_type.unit_defenses_label,
                struct_type.unit_defenses_description,
                struct_type.unit_description,
                struct_type.planetary_defenses,
                struct_type.planetary_defenses_label,
                struct_type.planetary_defenses_description,
                struct_type.ore_reserve_defenses,
                struct_type.ore_reserve_defenses_label,
                struct_type.ore_reserve_defenses_description,
                
                -- Power generation
                struct_type.power_generation,
                struct_type.power_generation_label,
                struct_type.generating_rate,
                
                -- Mining and refining
                struct_type.planetary_mining,
                struct_type.planetary_mining_label,
                struct_type.planetary_mining_description,
                struct_type.planetary_refinery,
                struct_type.planetary_refineries_label,
                struct_type.planetary_refineries_description,
                
                -- Drive
                struct_type.drive_label,
                struct_type.drive_description,
                
                -- Counter attack
                struct_type.counter_attack,
                struct_type.counter_attack_same_ambit,
                
                -- Other
                struct_type.stealth_systems,
                struct_type.attack_reduction,
                struct_type.attack_counterable,
                struct_type.post_destruction_damage,
                struct_type.planetary_shield_contribution,
                struct_type.ore_mining_difficulty,
                struct_type.ore_refining_difficulty
            FROM structs.struct_type
            WHERE struct_type.id = $1`,
            [structTypeId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const data = result.rows[0];
        
        // Parse JSON arrays if they exist
        if (data.primary_weapon_ambits_array && typeof data.primary_weapon_ambits_array === 'string') {
            try {
                data.primary_weapon_ambits_array = JSON.parse(data.primary_weapon_ambits_array);
            } catch (e) {
                data.primary_weapon_ambits_array = [];
            }
        }
        
        if (data.secondary_weapon_ambits_array && typeof data.secondary_weapon_ambits_array === 'string') {
            try {
                data.secondary_weapon_ambits_array = JSON.parse(data.secondary_weapon_ambits_array);
            } catch (e) {
                data.secondary_weapon_ambits_array = [];
            }
        }
        
        // Parse possible_ambit bitmask to array
        if (data.possible_ambit) {
            data.possible_ambit_array = [];
            if (data.possible_ambit & 16) data.possible_ambit_array.push('SPACE');
            if (data.possible_ambit & 8) data.possible_ambit_array.push('AIR');
            if (data.possible_ambit & 4) data.possible_ambit_array.push('LAND');
            if (data.possible_ambit & 2) data.possible_ambit_array.push('WATER');
        } else {
            data.possible_ambit_array = [];
        }

        return data;
    },

    /**
     * Get all struct types for autocomplete
     * @param {string} searchTerm - Search term to filter by
     * @returns {Promise<Array>} Array of struct types
     */
    async forAutocomplete(searchTerm = '') {
        const result = await db.query(
            `SELECT 
                struct_type.id,
                struct_type.type,
                UPPER(REPLACE(REPLACE(struct_type.type, ' ', '_'),'-','_')) as icon
            FROM structs.struct_type
            WHERE struct_type.type ILIKE $1
            ORDER BY struct_type.type
            LIMIT 25`,
            [`%${searchTerm}%`]
        );

        return result.rows;
    }
};

module.exports = {
    fetchStructTypeData
};

