/**
 * ChargeCalculator utility - replicates webapp logic
 * @module utils/chargeCalculator
 */

class ChargeCalculator {
    constructor() {
        this.chargeLevelThresholds = [0, 1, 8, 20, 39, 666];
    }

    /**
     * Calculate charge level from charge value
     * @param {number} charge - Charge value
     * @returns {number} Charge level (0-5)
     */
    calcChargeLevelByCharge(charge) {
        for (let i = 0; i < this.chargeLevelThresholds.length; i++) {
            if (charge <= this.chargeLevelThresholds[i]) {
                return i;
            }
        }
        return this.chargeLevelThresholds.length - 1;
    }

    /**
     * Calculate charge from block heights
     * @param {number} currentBlockHeight - Current block height
     * @param {number} lastActionBlockHeight - Last action block height
     * @returns {number} Charge value
     */
    calcCharge(currentBlockHeight, lastActionBlockHeight) {
        return currentBlockHeight - lastActionBlockHeight;
    }

    /**
     * Calculate charge level from block heights
     * @param {number} currentBlockHeight - Current block height
     * @param {number} lastActionBlockHeight - Last action block height
     * @returns {number} Charge level (0-5)
     */
    calc(currentBlockHeight, lastActionBlockHeight) {
        const charge = this.calcCharge(currentBlockHeight, lastActionBlockHeight);
        return this.calcChargeLevelByCharge(charge);
    }
}

module.exports = ChargeCalculator;

