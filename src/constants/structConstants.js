/**
 * Struct constants replicated from structs-webapp
 * @module constants/structConstants
 */

const STRUCT_CATEGORIES = {
    FLEET: 'fleet',
    PLANET: 'planet'
};

const STRUCT_VARIANTS = {
    BASE: 'base',
    DMG: 'dmg',
    BLINK: 'blink'
};

const STRUCT_EQUIPMENT_ICON_MAP = {
    'attackRun': 'icon-ballistic-weapon',
    'guidedWeaponry': 'icon-smart-weapon',
    'unguidedWeaponry': 'icon-ballistic-weapon',

    'advancedCounterAttack': 'icon-adv-counter',
    'counterAttack': 'icon-counter',
    'strongCounterAttack': 'icon-adv-counter',

    'armour': 'icon-armour',
    'defensiveManeuver': 'icon-kinetic-barrier',
    'indirectCombatModule': 'icon-indirect',
    'signalJamming': 'icon-signal-jam',
    'stealthMode': 'icon-stealth',

    'coordinatedReserveResponseTracker': 'icon-planetary-shield',
    'defensiveCannon': 'icon-counter',
    'lowOrbitBallisticInterceptorNetwork': 'icon-signal-jam',
    'monitoringStation': 'icon-planetary-shield',
    'oreBunker': 'icon-planetary-shield',
    'smallGenerator': 'icon-refine'
};

const STRUCT_DESCRIPTIONS = {
    "Battleship": "",
    "Command Ship": "",
    "Continental Power Plant": "Consumes Alpha Matter to generate Energy.",
    "Cruiser": "",
    "Destroyer": "",
    "Field Generator": "Consumes Alpha Matter to generate Energy.",
    "Frigate": "",
    "High Altitude Interceptor": "",
    "Jamming Satellite": "Applies Signal Jamming to all enemy Smart Attacks.",
    "Mobile Artillery": "",
    "Orbital Shield Generator": "Improves Planetary Defense.",
    "Ore Bunker": "Massively improves Planetary Defense by storing Ore underground.",
    "Ore Extractor": "Extracts Alpha Ore from the planet.",
    "Ore Refinery": "Refines Ore into usable Alpha Matter.",
    "Planetary Defense Cannon": "Launches Counter-Attacks against attacking Structs.",
    "Pursuit Fighter": "",
    "SAM Launcher": "",
    "Starfighter": "",
    "Stealth Bomber": "",
    "Submersible": "",
    "Tank": "",
    "World Engine": "Consumes Alpha Matter to generate Energy."
};

const AMBIT_ORDER = [
    'SPACE',
    'AIR',
    'LAND',
    'WATER'
];

// Map struct type names to image directory names
const STRUCT_TYPE_TO_IMAGE_DIR = {
    "Battleship": "battleship",
    "Command Ship": "cmd-ship",
    "Cruiser": "cruiser",
    "Destroyer": "destroyer",
    "Ore Extractor": "extractor",
    "Frigate": "frigate",
    "Field Generator": "generator",
    "High Altitude Interceptor": "interceptor",
    "Jamming Satellite": "jamming-sat",
    "Mobile Artillery": "mobile-artillery",
    "Orbital Shield Generator": "orb-shield",
    "Ore Bunker": "ore-bunker",
    "Planetary Defense Cannon": "pdc",
    "Pursuit Fighter": "pursuit-fighter",
    "Ore Refinery": "refinery",
    "SAM Launcher": "sam-launcher",
    "Starfighter": "starfighter",
    "Stealth Bomber": "stealth-bomber",
    "Submersible": "submersible",
    "Tank": "tank"
};

module.exports = {
    STRUCT_CATEGORIES,
    STRUCT_VARIANTS,
    STRUCT_EQUIPMENT_ICON_MAP,
    STRUCT_DESCRIPTIONS,
    AMBIT_ORDER,
    STRUCT_TYPE_TO_IMAGE_DIR
};

