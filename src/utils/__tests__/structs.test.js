const { formatStructChoice, getStructAttribute } = require('../structs');
const { EMOJIS } = require('../../constants/emojis');
const db = require('../../database');

jest.mock('../../database');
jest.mock('../../constants/emojis', () => ({
    EMOJIS: {
        COMMAND_SHIP: '🚀',
        RANGE_16: '🌌',
        RANGE_8: '✈️',
        RANGE_4: '🏔️',
        RANGE_2: '🌊'
    }
}));

describe('structs utilities', () => {
    describe('formatStructChoice', () => {
        test('formats struct choice with emojis', () => {
            const row = {
                name: '5-123 Command Ship',
                ambit: 16,
                icon: 'COMMAND_SHIP',
                value: '5-123'
            };

            const result = formatStructChoice(row);

            expect(result).toEqual({
                name: '🚀 5-123 Command Ship 🌌',
                value: '5-123'
            });
        });

        test('uses default emoji when icon not found', () => {
            const row = {
                name: '5-123 Unknown',
                ambit: 16,
                icon: 'UNKNOWN_TYPE',
                value: '5-123'
            };

            const result = formatStructChoice(row);

            expect(result.name).toContain('🏗️'); // default emoji
            expect(result.value).toBe('5-123');
        });

        test('uses default emoji when ambit not found', () => {
            const row = {
                name: '5-123 Test',
                ambit: 999,
                icon: 'COMMAND_SHIP',
                value: '5-123'
            };

            const result = formatStructChoice(row);

            expect(result.name).toContain('🌍'); // default ambit emoji
        });
    });

    describe('getStructAttribute', () => {
        test('returns attribute value when found', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ val: 1000 }]
            });

            const result = await getStructAttribute('5-123', 'blockStartBuild');

            expect(result).toBe(1000);
            expect(db.query).toHaveBeenCalledWith(
                'SELECT val FROM structs.struct_attribute WHERE object_id = $1 AND attribute_type = $2',
                ['5-123', 'blockStartBuild']
            );
        });

        test('returns null when attribute not found', async () => {
            db.query.mockResolvedValueOnce({
                rows: []
            });

            const result = await getStructAttribute('5-123', 'blockStartBuild');

            expect(result).toBeNull();
        });

        test('handles database errors', async () => {
            db.query.mockRejectedValueOnce(new Error('Database error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const result = await getStructAttribute('5-123', 'blockStartBuild');

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});

