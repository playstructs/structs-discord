const path = require('path');
const fs = require('fs').promises;
const ChargeCalculator = require('../utils/chargeCalculator');
const NumberFormatter = require('../utils/numberFormatter');
const {
    STRUCT_DESCRIPTIONS,
    STRUCT_EQUIPMENT_ICON_MAP,
    AMBIT_ORDER,
    STRUCT_TYPE_TO_IMAGE_DIR
} = require('../constants/structConstants');

/**
 * Cheatsheet HTML builder - replicates webapp CheatsheetContentBuilder
 * @module builders/cheatsheetBuilder
 */

// Ambit icon class mapping (using Structicons font)
const AMBIT_ICON_CLASSES = {
    'space': 'sui-icon-space',
    'air': 'sui-icon-air',
    'land': 'sui-icon-land',
    'water': 'sui-icon-water'
};

class CheatsheetBuilder {
    constructor() {
        this.chargeCalculator = new ChargeCalculator();
        this.numberFormatter = new NumberFormatter();
        this.structImageDir = path.join(__dirname, '../../assets/img/structs');
    }


    /**
     * Get passive weaponry ambits from primary and secondary weapons
     * @param {Object} structType - Struct type data
     * @returns {Array<string>} Array of ambits (resolved, lowercase)
     */
    getPassiveWeaponryAmbits(structType) {
        const possibleAmbits = (structType.possible_ambit_array || []).map(a => a.toLowerCase());
        
        // Resolve ambits from both weapons, handling "local" special case
        const primaryResolved = this.resolveAmbits(
            structType.primary_weapon_ambits_array || [],
            possibleAmbits
        );
        const secondaryResolved = this.resolveAmbits(
            structType.secondary_weapon_ambits_array || [],
            possibleAmbits
        );
        
        // Combine and remove duplicates
        const ambits = new Set([...primaryResolved, ...secondaryResolved]);
        return [...ambits].sort((a, b) => {
            const indexA = AMBIT_ORDER.indexOf(a.toUpperCase());
            const indexB = AMBIT_ORDER.indexOf(b.toUpperCase());
            return indexA - indexB;
        });
    }

    /**
     * Render battery cost HTML
     * @param {number|null} batteryCost - Battery cost
     * @returns {string} HTML
     */
    renderBatteryCostHTML(batteryCost) {
        if (batteryCost === null || batteryCost === undefined) {
            return '';
        }

        let batteryChunks = '';
        const chargeLevel = this.chargeCalculator.calcChargeLevelByCharge(batteryCost);

        for (let i = 1; i < this.chargeCalculator.chargeLevelThresholds.length; i++) {
            const isFilled = i <= chargeLevel;
            const isFilledClass = isFilled ? 'sui-mod-filled' : '';
            batteryChunks += `<div class="sui-battery-chunk ${isFilledClass}"></div>`;
        }

        return `
            <div class="sui-battery">
                ${batteryChunks}
            </div>
        `;
    }

    /**
     * Render energy cost HTML
     * @param {number|null} energyCost - Energy cost
     * @returns {string} HTML
     */
    renderEnergyCostHTML(energyCost) {
        if (energyCost === null || energyCost === undefined) {
            return '';
        }
        return `
            <div class="sui-cheatsheet-cost">
                ${this.numberFormatter.format(energyCost)} <i class="sui-icon sui-icon-energy"></i>
            </div>
        `;
    }

    /**
     * Render title HTML
     * @param {string} titleText - Title text
     * @param {number|null} batteryCost - Battery cost
     * @param {number|null} energyCost - Energy cost
     * @returns {string} HTML
     */
    renderTitleHTML(titleText, batteryCost, energyCost) {
        return `
            <div class="sui-cheatsheet-title">
                <div class="sui-cheatsheet-title-text">${titleText.toUpperCase()}</div>
                <div class="sui-cheatsheet-costs">
                    ${this.renderBatteryCostHTML(batteryCost)}
                    ${this.renderEnergyCostHTML(energyCost)}
                </div>
            </div>
        `;
    }

    /**
     * Render description HTML
     * @param {string|null} descriptionText - Description text
     * @returns {string} HTML
     */
    renderDescriptionHTML(descriptionText) {
        if (!descriptionText) {
            return '';
        }
        return `
            <div class="sui-cheatsheet-description">
                ${descriptionText}
            </div>
        `;
    }

    /**
     * Render contextual message HTML
     * @param {string|null} contextualMessageText - Contextual message
     * @returns {string} HTML
     */
    renderContextualMessageHTML(contextualMessageText) {
        if (!contextualMessageText) {
            return '';
        }
        return `
            <div class="sui-cheatsheet-contextual-message">
                ${contextualMessageText}
            </div>
        `;
    }

    /**
     * Render property section HTML
     * @param {string|null} propertySectionHTML - Properties HTML
     * @returns {string} HTML
     */
    renderCheatsheetPropertySectionHTML(propertySectionHTML) {
        if (!propertySectionHTML) {
            return '';
        }
        return `
            <div class="sui-cheatsheet-property-section">
                ${propertySectionHTML}
            </div>
        `;
    }

    /**
     * Render struct image HTML
     * @param {Object} structType - Struct type data
     * @returns {Promise<string>} HTML
     */
    async renderStructImage(structType) {
        const structTypeName = structType.type;
        const imageDirName = STRUCT_TYPE_TO_IMAGE_DIR[structTypeName];
        
        if (!imageDirName) {
            return ''; // No image available for this struct type
        }

        const structDir = path.join(this.structImageDir, imageDirName);
        
        // Check if directory exists
        try {
            await fs.access(structDir);
        } catch {
            return ''; // Directory doesn't exist
        }

        // Build image paths
        const baseImage = path.join(structDir, `${imageDirName}-struct-base.png`);
        const baseImagePath = `file://${baseImage.replace(/\\/g, '/')}`;

        // Get top and bottom detail layers based on struct type
        const topLayers = [];
        const bottomLayers = [];

        // Try to find top detail layers
        try {
            const files = await fs.readdir(structDir);
            for (const file of files) {
                if (file.includes('top-') && file.endsWith('.png')) {
                    topLayers.push(`file://${path.join(structDir, file).replace(/\\/g, '/')}`);
                } else if (file.includes('bottom-') && file.endsWith('.png')) {
                    bottomLayers.push(`file://${path.join(structDir, file).replace(/\\/g, '/')}`);
                }
            }
        } catch {
            // If we can't read directory, just use base image
        }

        // Build HTML for layered images
        let imageHTML = '<div class="struct-still" style="width: 200px; height: 200px; margin: 0 auto;">';
        
        // Top detail layers
        for (const layer of topLayers) {
            imageHTML += `<img src="${layer}" class="struct-top-detail" alt="" style="position: absolute; z-index: 3;"/>`;
        }
        
        // Base struct image
        imageHTML += `<img src="${baseImagePath}" alt="" style="position: absolute; z-index: 2;"/>`;
        
        // Bottom detail layers
        for (const layer of bottomLayers) {
            imageHTML += `<img src="${layer}" class="struct-bottom-detail" alt="" style="position: absolute; z-index: 1;"/>`;
        }
        
        imageHTML += '</div>';

        return imageHTML;
    }

    /**
     * Convert numeric ambit flag to ambit name
     * @param {number|string} value - Ambit value (numeric flag or string)
     * @returns {string|null} Ambit name in lowercase, or null if invalid
     */
    numericAmbitToName(value) {
        const num = typeof value === 'string' ? parseInt(value, 10) : value;
        if (isNaN(num)) return null;
        
        // Ambit flags: 16=SPACE, 8=AIR, 4=LAND, 2=WATER
        const flagMap = {
            16: 'space',
            8: 'air',
            4: 'land',
            2: 'water'
        };
        
        // Check flag map first
        if (flagMap[num]) {
            return flagMap[num];
        }
        
        // Handle 1-based index mapping (in case database uses indices)
        // Based on AMBIT_ORDER: SPACE, AIR, LAND, WATER
        const indexMap = {
            1: 'space',  // Index 1 = SPACE (first in AMBIT_ORDER)
            2: 'air',    // Index 2 = AIR (second in AMBIT_ORDER)
            3: 'land',   // Index 3 = LAND (third in AMBIT_ORDER)
            4: 'water'   // Index 4 = WATER (fourth in AMBIT_ORDER)
        };
        
        return indexMap[num] || null;
    }

    /**
     * Resolve ambit values - handle "local" and numeric flags
     * @param {Array<string|number>} ambits - Ambit values from database (may be strings or numbers)
     * @param {Array<string>} possibleAmbits - Struct's possible ambits
     * @returns {Array<string>} Resolved ambit values (lowercase strings)
     */
    resolveAmbits(ambits, possibleAmbits) {
        if (!ambits || ambits.length === 0) {
            return [];
        }
        
        const resolved = [];
        
        for (const ambit of ambits) {
            // Handle "local" special case
            if (typeof ambit === 'string' && ambit.toLowerCase() === 'local') {
                // Replace "local" with struct's possible ambits
                resolved.push(...(possibleAmbits || []).map(a => a.toLowerCase()));
                continue;
            }
            
            // Handle numeric ambit flags (1, 2, 4, 8, 16)
            if (typeof ambit === 'number' || (typeof ambit === 'string' && !isNaN(parseInt(ambit, 10)))) {
                const ambitName = this.numericAmbitToName(ambit);
                if (ambitName) {
                    resolved.push(ambitName);
                }
                continue;
            }
            
            // Handle string ambit names (space, air, land, water)
            if (typeof ambit === 'string') {
                const normalized = ambit.toLowerCase();
                // Validate it's a valid ambit name
                if (AMBIT_ORDER.includes(normalized.toUpperCase())) {
                    resolved.push(normalized);
                }
            }
        }
        
        // Remove duplicates and sort
        return [...new Set(resolved)].sort((a, b) => {
            const indexA = AMBIT_ORDER.indexOf(a.toUpperCase());
            const indexB = AMBIT_ORDER.indexOf(b.toUpperCase());
            return indexA - indexB;
        });
    }

    /**
     * Render weapon property HTML
     * @param {string} weaponType - Weapon type
     * @param {string} weaponLabel - Weapon label (human-readable)
     * @param {number} weaponDamage - Weapon damage
     * @param {Array<string>} weaponAmbits - Weapon ambits (may contain "local")
     * @param {string} notEquippedValue - Value indicating not equipped
     * @param {Array<string>} possibleAmbits - Struct's possible ambits (for resolving "local")
     * @returns {string} HTML
     */
    renderWeaponProperty(weaponType, weaponLabel, weaponDamage, weaponAmbits, notEquippedValue, possibleAmbits = []) {
        if (!weaponType || weaponType === notEquippedValue) {
            return '';
        }

        const iconClass = STRUCT_EQUIPMENT_ICON_MAP[weaponType] || 'icon-ballistic-weapon';
        
        // Resolve ambits (handle "local" special case)
        const resolvedAmbits = this.resolveAmbits(weaponAmbits, possibleAmbits);
        
        const ambitIcons = resolvedAmbits.map(ambit => {
            // Ensure ambit is a valid string key (should already be from resolveAmbits, but be safe)
            const ambitKey = typeof ambit === 'string' ? ambit.toLowerCase() : String(ambit).toLowerCase();
            const ambitIconClass = AMBIT_ICON_CLASSES[ambitKey] || 'sui-icon-space';
            return `<i class="sui-icon ${ambitIconClass}"></i>`;
        }).join('');

        // Use human-readable label, fallback to type if label not available
        const displayLabel = weaponLabel || weaponType;

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    <i class="sui-icon sui-icon-md ${iconClass}"></i>
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>${displayLabel}</div>
                    <div>
                        ${weaponDamage} DMG ${ambitIcons}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render passive weaponry property HTML
     * @param {Object} structType - Struct type data
     * @returns {string} HTML
     */
    renderPassiveWeaponProperty(structType) {
        if (!structType.passive_weaponry || structType.passive_weaponry === 'noPassiveWeaponry') {
            return '';
        }

        const iconClass = STRUCT_EQUIPMENT_ICON_MAP[structType.passive_weaponry] || 'icon-counter';
        const weaponAmbits = this.getPassiveWeaponryAmbits(structType);
        const possibleAmbitsLower = (structType.possible_ambit_array || []).map(a => a.toLowerCase());

        let damageHTML = '';

        if (structType.counter_attack_same_ambit > structType.counter_attack) {
            const regularAmbits = weaponAmbits.filter(a => !possibleAmbitsLower.includes(a.toLowerCase()));
            const sameAmbits = weaponAmbits.filter(a => possibleAmbitsLower.includes(a.toLowerCase()));

            if (regularAmbits.length > 0) {
                const regularIcons = regularAmbits.map(ambit => {
                    // Ensure ambit is a string and lowercase
                    const ambitStr = typeof ambit === 'string' ? ambit : String(ambit);
                    const ambitLower = ambitStr.toLowerCase();
                    const ambitIconClass = AMBIT_ICON_CLASSES[ambitLower] || 'sui-icon-space';
                    return `<i class="sui-icon ${ambitIconClass}"></i>`;
                }).join('');
                damageHTML += `${structType.counter_attack} DMG ${regularIcons} `;
            }

            if (sameAmbits.length > 0) {
                const sameIcons = sameAmbits.map(ambit => {
                    // Ensure ambit is a string and lowercase
                    const ambitStr = typeof ambit === 'string' ? ambit : String(ambit);
                    const ambitLower = ambitStr.toLowerCase();
                    const ambitIconClass = AMBIT_ICON_CLASSES[ambitLower] || 'sui-icon-space';
                    return `<i class="sui-icon ${ambitIconClass}"></i>`;
                }).join('');
                damageHTML += `${structType.counter_attack_same_ambit} DMG ${sameIcons}`;
            }
        } else {
            const ambitIcons = weaponAmbits.map(ambit => {
                // Ensure ambit is a string and lowercase
                const ambitStr = typeof ambit === 'string' ? ambit : String(ambit);
                const ambitLower = ambitStr.toLowerCase();
                const ambitIconClass = AMBIT_ICON_CLASSES[ambitLower] || 'sui-icon-space';
                return `<i class="sui-icon ${ambitIconClass}"></i>`;
            }).join('');
            damageHTML = `${structType.counter_attack} DMG ${ambitIcons}`;
        }

        // Use human-readable label, fallback to type if label not available
        const displayLabel = structType.passive_weaponry_label || structType.passive_weaponry;

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    <i class="sui-icon sui-icon-md ${iconClass}"></i>
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>${displayLabel}</div>
                    <div>
                        ${damageHTML}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render unit defenses property HTML
     * @param {Object} structType - Struct type data
     * @returns {string} HTML
     */
    renderUnitDefensesProperty(structType) {
        if (structType.unit_defenses === 'noUnitDefenses') {
            return '';
        }

        const iconClass = STRUCT_EQUIPMENT_ICON_MAP[structType.unit_defenses] || 'icon-armour';

        // Use human-readable label, fallback to type if label not available
        const displayLabel = structType.unit_defenses_label || structType.unit_defenses;

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    <i class="sui-icon sui-icon-md ${iconClass}"></i>
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>${displayLabel}</div>
                </div>
            </div>
        `;
    }

    /**
     * Render planetary defenses property HTML
     * @param {Object} structType - Struct type data
     * @returns {string} HTML
     */
    renderPlanetaryDefensesProperty(structType) {
        switch (structType.planetary_defenses) {
            case 'noPlanetaryDefense':
                return '';
            case 'defensiveCannon':
                // Use human-readable label for defensive cannon
                const defensiveCannonLabel = structType.planetary_defenses_label || 'Defensive Cannon';
                const possibleAmbits = (structType.possible_ambit_array || []).map(a => a.toLowerCase());
                return this.renderWeaponProperty(
                    structType.planetary_defenses,
                    defensiveCannonLabel,
                    1,
                    AMBIT_ORDER.map(ambit => ambit.toLowerCase()),
                    'noPlanetaryDefense',
                    possibleAmbits
                );
            default:
                const iconClass = STRUCT_EQUIPMENT_ICON_MAP[structType.planetary_defenses] || 'icon-planetary-shield';

                // Use human-readable label, fallback to type if label not available
                const displayLabel = structType.planetary_defenses_label || structType.planetary_defenses;

                return `
                    <div class="sui-cheatsheet-property">
                        <div class="sui-cheatsheet-property-icon">
                            <i class="sui-icon sui-icon-md ${iconClass}"></i>
                        </div>
                        <div class="sui-cheatsheet-property-info">
                            <div>${displayLabel}</div>
                        </div>
                    </div>
                `;
        }
    }

    /**
     * Render ore reserve defenses property HTML
     * @param {Object} structType - Struct type data
     * @returns {string} HTML
     */
    renderOreReserveDefensesProperty(structType) {
        if (structType.ore_reserve_defenses === 'noOreReserveDefenses') {
            return '';
        }

        const iconClass = STRUCT_EQUIPMENT_ICON_MAP[structType.ore_reserve_defenses] || 'icon-planetary-shield';
        const planetaryShieldContribution = this.numberFormatter.format(structType.planetary_shield_contribution || 0);

        // Use human-readable label, fallback to type if label not available
        const displayLabel = structType.ore_reserve_defenses_label || structType.ore_reserve_defenses;

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    <i class="sui-icon sui-icon-md ${iconClass}"></i>
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>${displayLabel}</div>
                    <div>+${planetaryShieldContribution} Planetary Defense</div>
                </div>
            </div>
        `;
    }

    /**
     * Render power generation property HTML
     * @param {Object} structType - Struct type data
     * @returns {string} HTML
     */
    renderPowerGenerationProperty(structType) {
        if (structType.power_generation === 'noPowerGeneration') {
            return '';
        }

        const iconClass = STRUCT_EQUIPMENT_ICON_MAP[structType.power_generation] || 'icon-refine';

        // Use human-readable label if available, otherwise use default text
        const powerLabel = structType.power_generation_label || 'Power Generation';

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    <i class="sui-icon sui-icon-md icon-send-alpha"></i>
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>Consume Alpha</div>
                </div>
            </div>
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    <i class="sui-icon sui-icon-md ${iconClass}"></i>
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>${powerLabel}: +${structType.generating_rate || 0} KW Per Alpha</div>
                </div>
            </div>
        `;
    }

    /**
     * Render content HTML (main cheatsheet structure)
     * @param {string} titleText - Title text
     * @param {number|null} batteryCost - Battery cost
     * @param {number|null} energyCost - Energy cost
     * @param {string|null} descriptionText - Description
     * @param {string|null} contextualMessageText - Contextual message
     * @param {string|null} propertySectionHTML - Properties HTML
     * @param {string|null} structImageHTML - Struct image HTML
     * @returns {string} HTML
     */
    renderContentHTML(titleText, batteryCost, energyCost, descriptionText, contextualMessageText, propertySectionHTML, structImageHTML) {
        // Note: structImageHTML is kept for API compatibility but not rendered to match webapp
        // Add sui-theme-player class so battery filled chunks display correctly
        return `
            <div class="sui-cheatsheet sui-theme-player">
                <div class="sui-cheatsheet-top-frame"></div>
                
                ${this.renderTitleHTML(titleText, batteryCost, energyCost)}
                
                <div class="sui-cheatsheet-content">
                    ${this.renderDescriptionHTML(descriptionText)}
                    
                    ${this.renderCheatsheetPropertySectionHTML(propertySectionHTML)}
                    
                    ${this.renderContextualMessageHTML(contextualMessageText)}
                </div>
            </div>
        `;
    }

    /**
     * Build struct cheatsheet HTML
     * @param {Object} structType - Struct type data
     * @returns {Promise<string>} HTML
     */
    async buildStructCheatsheet(structType) {
        let propertiesHTML = '';
        
        // Get possible ambits (for resolving "local")
        const possibleAmbits = (structType.possible_ambit_array || []).map(a => a.toLowerCase());

        propertiesHTML += this.renderWeaponProperty(
            structType.primary_weapon,
            structType.primary_weapon_label,
            structType.primary_weapon_damage,
            structType.primary_weapon_ambits_array || [],
            'noActiveWeaponry',
            possibleAmbits
        );

        propertiesHTML += this.renderWeaponProperty(
            structType.secondary_weapon,
            structType.secondary_weapon_label,
            structType.secondary_weapon_damage,
            structType.secondary_weapon_ambits_array || [],
            'noActiveWeaponry',
            possibleAmbits
        );

        propertiesHTML += this.renderPassiveWeaponProperty(structType);
        propertiesHTML += this.renderUnitDefensesProperty(structType);
        propertiesHTML += this.renderPlanetaryDefensesProperty(structType);
        propertiesHTML += this.renderOreReserveDefensesProperty(structType);
        propertiesHTML += this.renderPowerGenerationProperty(structType);

        // Render struct image
        const structImageHTML = await this.renderStructImage(structType);

        const titleText = `${structType.default_cosmetic_model_number || ''} ${structType.class || structType.type}`.trim();
        const description = STRUCT_DESCRIPTIONS[structType.type] || '';

        return this.renderContentHTML(
            titleText,
            structType.build_charge,
            structType.build_draw,
            description,
            '',
            propertiesHTML || null,
            structImageHTML
        );
    }
}

module.exports = CheatsheetBuilder;

