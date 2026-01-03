const db = require('../database');

/**
 * Get current block number from consensus
 * @returns {Promise<number|null>} Current block number or null if not found
 */
async function getCurrentBlock() {
    try {
        const result = await db.query('SELECT MAX(block) as current_block FROM structs.consensus');
        return result.rows.length > 0 && result.rows[0].current_block ? parseInt(result.rows[0].current_block) : null;
    } catch (error) {
        console.error('Error getting current block:', error);
        return null;
    }
}

/**
 * Get structure state from status flags
 * @param {number} statusFlags - Status flags value
 * @returns {Object} State information
 */
function getStructState(statusFlags) {
    const flags = statusFlags || 0;
    const isBuilt = (flags & 2) > 0;
    const isActive = (flags & 4) > 0;
    const isStealth = (flags & 16) > 0;
    
    let state = 'Defined';
    if (isBuilt && isActive) {
        state = isStealth ? 'Stealth' : 'Active';
    } else if (isBuilt) {
        state = 'Built';
    }
    
    return {
        state,
        isBuilt,
        isActive,
        isStealth
    };
}

/**
 * Get comprehensive structure status
 * @param {string} structId - Structure ID
 * @param {string} playerId - Player ID (for ownership verification)
 * @returns {Promise<Object|null>} Structure status object or null if not found
 */
async function getStructStatus(structId, playerId) {
    try {
        const result = await db.query(
            `SELECT 
                struct.id,
                struct_type.type,
                struct.operating_ambit,
                struct.owner,
                struct.location_id as planet_id,
                struct.slot,
                struct_type.planetary_mining,
                struct_type.planetary_refinery,
                struct_type.primary_weapon,
                struct_type.stealth_systems,
                (SELECT val FROM structs.struct_attribute 
                 WHERE object_id = struct.id 
                 AND attribute_type = 'status') as status_flags,
                (SELECT val FROM structs.struct_attribute 
                 WHERE object_id = struct.id 
                 AND attribute_type = 'blockStartBuild') as build_start_block,
                (SELECT val FROM structs.struct_attribute 
                 WHERE object_id = struct.id 
                 AND attribute_type = 'blockStartOreMine') as mine_start_block,
                (SELECT val FROM structs.struct_attribute 
                 WHERE object_id = struct.id 
                 AND attribute_type = 'blockStartOreRefine') as refine_start_block,
                (SELECT object_id FROM structs.struct_attribute 
                 WHERE attribute_type = 'defense' 
                 AND val = struct.id) as protected_struct_id
             FROM structs.struct
             JOIN structs.struct_type ON struct.type = struct_type.id
             WHERE struct.id = $1 AND struct.owner = $2`,
            [structId, playerId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const struct = result.rows[0];
        const currentBlock = await getCurrentBlock();
        const stateInfo = getStructState(struct.status_flags);

        return {
            ...struct,
            ...stateInfo,
            currentBlock,
            buildProgress: struct.build_start_block && !stateInfo.isBuilt ? {
                startBlock: struct.build_start_block,
                currentBlock: currentBlock,
                blocksElapsed: currentBlock ? currentBlock - struct.build_start_block : null
            } : null,
            miningActive: struct.mine_start_block && stateInfo.isActive ? {
                startBlock: struct.mine_start_block,
                currentBlock: currentBlock,
                blocksElapsed: currentBlock ? currentBlock - struct.mine_start_block : null
            } : null,
            refiningActive: struct.refine_start_block && stateInfo.isActive ? {
                startBlock: struct.refine_start_block,
                currentBlock: currentBlock,
                blocksElapsed: currentBlock ? currentBlock - struct.refine_start_block : null
            } : null,
            capabilities: {
                canMine: struct.planetary_mining !== 'noPlanetaryMining',
                canRefine: struct.planetary_refinery !== 'noPlanetaryRefinery',
                canAttack: struct.primary_weapon !== 'noActiveWeaponry',
                hasStealth: struct.stealth_systems === true
            }
        };
    } catch (error) {
        console.error(`Error getting struct status for ${structId}:`, error);
        return null;
    }
}

/**
 * Get fleet status information
 * @param {string} playerId - Player ID
 * @returns {Promise<Object|null>} Fleet status object or null if not found
 */
async function getFleetStatus(playerId) {
    try {
        // Get fleet info
        const fleetResult = await db.query(
            `SELECT 
                fleet.id as fleet_id,
                fleet.owner,
                fleet.location_id as planet_id,
                player.fleet_id
             FROM structs.fleet, structs.player
             WHERE fleet.owner = $1 
             AND player.id = $1
             AND player.fleet_id = fleet.id`,
            [playerId]
        );

        if (fleetResult.rows.length === 0) {
            return null;
        }

        const fleet = fleetResult.rows[0];
        const currentBlock = await getCurrentBlock();

        // Get active raid status
        const raidResult = await db.query(
            `SELECT planet_attribute.val as active_raid_block
             FROM structs.planet_attribute
             WHERE planet_attribute.object_id = $1
             AND planet_attribute.attribute_type = 'blockStartRaid'`,
            [fleet.planet_id]
        );

        const activeRaidBlock = raidResult.rows.length > 0 ? raidResult.rows[0].active_raid_block : null;

        // Get command ship
        const commandShipResult = await db.query(
            `SELECT struct.id as command_ship_id, struct_type.type as command_ship_type
             FROM structs.struct, structs.struct_type, structs.fleet
             WHERE fleet.id = $1
             AND struct.location_id = fleet.location_id
             AND struct.type = struct_type.id
             AND struct_type.type = 'Command Ship'
             LIMIT 1`,
            [fleet.fleet_id]
        );

        return {
            ...fleet,
            currentBlock,
            raidStatus: activeRaidBlock ? {
                isRaiding: true,
                targetPlanet: fleet.planet_id,
                startBlock: activeRaidBlock,
                currentBlock: currentBlock,
                blocksElapsed: currentBlock ? currentBlock - activeRaidBlock : null
            } : {
                isRaiding: false
            },
            commandShip: commandShipResult.rows.length > 0 ? {
                id: commandShipResult.rows[0].command_ship_id,
                type: commandShipResult.rows[0].command_ship_type
            } : null
        };
    } catch (error) {
        console.error(`Error getting fleet status for player ${playerId}:`, error);
        return null;
    }
}

/**
 * Get all active operations for a player
 * @param {string} playerId - Player ID
 * @param {string|null} type - Operation type filter ('build', 'mine', 'refine', 'raid') or null for all
 * @returns {Promise<Array>} Array of active operations
 */
async function getActiveOperations(playerId, type = null) {
    try {
        const currentBlock = await getCurrentBlock();
        const operations = [];

        // Get building structures
        if (!type || type === 'build') {
            const buildResult = await db.query(
                `SELECT struct.id, struct_type.type,
                        struct_attribute.val as start_block
                 FROM structs.struct, structs.struct_type, structs.struct_attribute
                 WHERE struct.owner = $1
                 AND struct.type = struct_type.id
                 AND struct_attribute.object_id = struct.id
                 AND struct_attribute.attribute_type = 'blockStartBuild'
                 AND struct.id IN (
                     SELECT struct_attribute.object_id
                     FROM structs.struct_attribute
                     WHERE struct_attribute.attribute_type = 'status'
                     AND (struct_attribute.val & 2) = 0
                 )`,
                [playerId]
            );

            for (const row of buildResult.rows) {
                operations.push({
                    type: 'build',
                    entityId: row.id,
                    entityType: row.type,
                    startBlock: row.start_block,
                    currentBlock: currentBlock,
                    blocksElapsed: currentBlock ? currentBlock - row.start_block : null
                });
            }
        }

        // Get mining structures
        if (!type || type === 'mine') {
            const mineResult = await db.query(
                `SELECT struct.id, struct_type.type,
                        struct_attribute.val as start_block
                 FROM structs.struct, structs.struct_type, structs.struct_attribute
                 WHERE struct.owner = $1
                 AND struct.type = struct_type.id
                 AND struct_attribute.object_id = struct.id
                 AND struct_attribute.attribute_type = 'blockStartOreMine'
                 AND struct.id IN (
                     SELECT struct_attribute.object_id
                     FROM structs.struct_attribute
                     WHERE struct_attribute.attribute_type = 'status'
                     AND (struct_attribute.val & 4) > 0
                 )`,
                [playerId]
            );

            for (const row of mineResult.rows) {
                operations.push({
                    type: 'mine',
                    entityId: row.id,
                    entityType: row.type,
                    startBlock: row.start_block,
                    currentBlock: currentBlock,
                    blocksElapsed: currentBlock ? currentBlock - row.start_block : null
                });
            }
        }

        // Get refining structures
        if (!type || type === 'refine') {
            const refineResult = await db.query(
                `SELECT struct.id, struct_type.type,
                        struct_attribute.val as start_block
                 FROM structs.struct, structs.struct_type, structs.struct_attribute
                 WHERE struct.owner = $1
                 AND struct.type = struct_type.id
                 AND struct_attribute.object_id = struct.id
                 AND struct_attribute.attribute_type = 'blockStartOreRefine'
                 AND struct.id IN (
                     SELECT struct_attribute.object_id
                     FROM structs.struct_attribute
                     WHERE struct_attribute.attribute_type = 'status'
                     AND (struct_attribute.val & 4) > 0
                 )`,
                [playerId]
            );

            for (const row of refineResult.rows) {
                operations.push({
                    type: 'refine',
                    entityId: row.id,
                    entityType: row.type,
                    startBlock: row.start_block,
                    currentBlock: currentBlock,
                    blocksElapsed: currentBlock ? currentBlock - row.start_block : null
                });
            }
        }

        // Get raiding fleets
        if (!type || type === 'raid') {
            const raidResult = await db.query(
                `SELECT 
                    fleet.id as fleet_id,
                    fleet.location_id as planet_id,
                    planet_attribute.val as start_block
                 FROM structs.fleet, structs.planet_attribute
                 WHERE fleet.owner = $1
                 AND planet_attribute.object_id = fleet.location_id
                 AND planet_attribute.attribute_type = 'blockStartRaid'`,
                [playerId]
            );

            for (const row of raidResult.rows) {
                operations.push({
                    type: 'raid',
                    entityId: row.fleet_id,
                    entityType: 'Fleet',
                    targetPlanet: row.planet_id,
                    startBlock: row.start_block,
                    currentBlock: currentBlock,
                    blocksElapsed: currentBlock ? currentBlock - row.start_block : null
                });
            }
        }

        return operations;
    } catch (error) {
        console.error(`Error getting active operations for player ${playerId}:`, error);
        return [];
    }
}

module.exports = {
    getCurrentBlock,
    getStructState,
    getStructStatus,
    getFleetStatus,
    getActiveOperations
};

