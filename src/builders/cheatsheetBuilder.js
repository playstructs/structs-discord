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

// Icon to emoji mapping (since we can't use icon fonts)
const ICON_TO_EMOJI = {
    'icon-ballistic-weapon': '⚔️',
    'icon-smart-weapon': '🎯',
    'icon-counter': '🛡️',
    'icon-adv-counter': '🛡️',
    'icon-armour': '🛡️',
    'icon-kinetic-barrier': '🛡️',
    'icon-indirect': '💥',
    'icon-signal-jam': '📡',
    'icon-stealth': '👁️',
    'icon-planetary-shield': '🛡️',
    'icon-refine': '⚙️',
    'icon-send-alpha': '⚡',
    'icon-energy': '⚡'
};

// Ambit icon mapping
const AMBIT_ICONS = {
    'space': '🚀',
    'air': '✈️',
    'land': '🏔️',
    'water': '🌊'
};

class CheatsheetBuilder {
    constructor() {
        this.chargeCalculator = new ChargeCalculator();
        this.numberFormatter = new NumberFormatter();
        this.structImageDir = path.join(__dirname, '../../.agents/repositories/structs-webapp/src/public/img/structs');
    }

    /**
     * Replace icon classes with emojis
     * @param {string} html - HTML string
     * @returns {string} HTML with emojis
     */
    replaceIcons(html) {
        let result = html;
        
        // Replace icon classes with emojis
        for (const [iconClass, emoji] of Object.entries(ICON_TO_EMOJI)) {
            result = result.replace(new RegExp(`<i class="[^"]*${iconClass}[^"]*"></i>`, 'g'), emoji);
        }
        
        // Replace ambit icons
        for (const [ambit, emoji] of Object.entries(AMBIT_ICONS)) {
            result = result.replace(new RegExp(`<i class="[^"]*sui-icon-${ambit}[^"]*"><\/i>`, 'g'), emoji);
        }
        
        // Remove any remaining icon tags
        result = result.replace(/<i class="[^"]*sui-icon[^"]*"><\/i>/g, '');
        
        return result;
    }

    /**
     * Get passive weaponry ambits from primary and secondary weapons
     * @param {Object} structType - Struct type data
     * @returns {Array<string>} Array of ambits
     */
    getPassiveWeaponryAmbits(structType) {
        const ambits = new Set([
            ...(structType.primary_weapon_ambits_array || []),
            ...(structType.secondary_weapon_ambits_array || [])
        ]);
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
            const isFilledClass = i <= chargeLevel ? 'sui-mod-filled' : '';
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
                ${this.numberFormatter.format(energyCost)} ⚡
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
     * Render weapon property HTML
     * @param {string} weaponType - Weapon type
     * @param {string} weaponLabel - Weapon label
     * @param {number} weaponDamage - Weapon damage
     * @param {Array<string>} weaponAmbits - Weapon ambits
     * @param {string} notEquippedValue - Value indicating not equipped
     * @returns {string} HTML
     */
    renderWeaponProperty(weaponType, weaponLabel, weaponDamage, weaponAmbits, notEquippedValue) {
        if (!weaponType || weaponType === notEquippedValue) {
            return '';
        }

        const iconClass = STRUCT_EQUIPMENT_ICON_MAP[weaponType] || 'icon-ballistic-weapon';
        const iconEmoji = ICON_TO_EMOJI[iconClass] || '⚔️';
        const ambitIcons = (weaponAmbits || []).map(ambit => {
            const ambitLower = ambit.toLowerCase();
            return AMBIT_ICONS[ambitLower] || '🚀';
        }).join('');

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    ${iconEmoji}
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>${weaponLabel || weaponType}</div>
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
        const iconEmoji = ICON_TO_EMOJI[iconClass] || '🛡️';
        const weaponAmbits = this.getPassiveWeaponryAmbits(structType);
        const possibleAmbitsLower = (structType.possible_ambit_array || []).map(a => a.toLowerCase());

        let damageHTML = '';

        if (structType.counter_attack_same_ambit > structType.counter_attack) {
            const regularAmbits = weaponAmbits.filter(a => !possibleAmbitsLower.includes(a.toLowerCase()));
            const sameAmbits = weaponAmbits.filter(a => possibleAmbitsLower.includes(a.toLowerCase()));

            if (regularAmbits.length > 0) {
                const regularIcons = regularAmbits.map(ambit => {
                    const ambitLower = ambit.toLowerCase();
                    return AMBIT_ICONS[ambitLower] || '🚀';
                }).join('');
                damageHTML += `${structType.counter_attack} DMG ${regularIcons} `;
            }

            if (sameAmbits.length > 0) {
                const sameIcons = sameAmbits.map(ambit => {
                    const ambitLower = ambit.toLowerCase();
                    return AMBIT_ICONS[ambitLower] || '🚀';
                }).join('');
                damageHTML += `${structType.counter_attack_same_ambit} DMG ${sameIcons}`;
            }
        } else {
            const ambitIcons = weaponAmbits.map(ambit => {
                const ambitLower = ambit.toLowerCase();
                return AMBIT_ICONS[ambitLower] || '🚀';
            }).join('');
            damageHTML = `${structType.counter_attack} DMG ${ambitIcons}`;
        }

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    ${iconEmoji}
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>${structType.passive_weaponry_label || structType.passive_weaponry}</div>
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
        const iconEmoji = ICON_TO_EMOJI[iconClass] || '🛡️';

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    ${iconEmoji}
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>${structType.unit_defenses_label || structType.unit_defenses}</div>
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
                return this.renderWeaponProperty(
                    structType.planetary_defenses,
                    structType.planetary_defenses_label,
                    1,
                    AMBIT_ORDER.map(ambit => ambit.toLowerCase()),
                    'noPlanetaryDefense'
                );
            default:
                const iconClass = STRUCT_EQUIPMENT_ICON_MAP[structType.planetary_defenses] || 'icon-planetary-shield';
                const iconEmoji = ICON_TO_EMOJI[iconClass] || '🛡️';

                return `
                    <div class="sui-cheatsheet-property">
                        <div class="sui-cheatsheet-property-icon">
                            ${iconEmoji}
                        </div>
                        <div class="sui-cheatsheet-property-info">
                            <div>${structType.planetary_defenses_label || structType.planetary_defenses}</div>
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
        const iconEmoji = ICON_TO_EMOJI[iconClass] || '🛡️';
        const planetaryShieldContribution = this.numberFormatter.format(structType.planetary_shield_contribution || 0);

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    ${iconEmoji}
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>${structType.ore_reserve_defenses_label || structType.ore_reserve_defenses}</div>
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
        const iconEmoji = ICON_TO_EMOJI[iconClass] || '⚙️';

        return `
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    ⚡
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>Consume Alpha</div>
                </div>
            </div>
            <div class="sui-cheatsheet-property">
                <div class="sui-cheatsheet-property-icon">
                    ${iconEmoji}
                </div>
                <div class="sui-cheatsheet-property-info">
                    <div>+${structType.generating_rate || 0} KW Per Alpha</div>
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
        return `
            <div class="sui-cheatsheet">
                <div class="sui-cheatsheet-top-frame"></div>
                
                ${structImageHTML ? `<div style="padding: 16px; display: flex; justify-content: center; background: var(--surface-default, #1a1a1a);">${structImageHTML}</div>` : ''}
                
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

        propertiesHTML += this.renderWeaponProperty(
            structType.primary_weapon,
            structType.primary_weapon_label,
            structType.primary_weapon_damage,
            structType.primary_weapon_ambits_array || [],
            'noActiveWeaponry'
        );

        propertiesHTML += this.renderWeaponProperty(
            structType.secondary_weapon,
            structType.secondary_weapon_label,
            structType.secondary_weapon_damage,
            structType.secondary_weapon_ambits_array || [],
            'noActiveWeaponry'
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

