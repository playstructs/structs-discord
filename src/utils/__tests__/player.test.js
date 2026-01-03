const { getPlayerId, getPlayerData, getPlayerIdWithValidation } = require('../player');
const db = require('../../database');
const { createWarningEmbed } = require('../errors');

jest.mock('../../database');
jest.mock('../errors', () => ({
    createWarningEmbed: jest.fn((title, description) => ({
        data: { title, description }
    }))
}));

describe('player utilities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getPlayerId', () => {
        test('returns player ID when found', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ player_id: '1-123' }]
            });

            const result = await getPlayerId('123456789');

            expect(result).toBe('1-123');
            expect(db.query).toHaveBeenCalledWith(
                'SELECT player_id FROM structs.player_discord WHERE discord_id = $1',
                ['123456789']
            );
        });

        test('returns null when player not found', async () => {
            db.query.mockResolvedValueOnce({
                rows: []
            });

            const result = await getPlayerId('123456789');

            expect(result).toBeNull();
        });

        test('handles database errors', async () => {
            db.query.mockRejectedValueOnce(new Error('Database error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const result = await getPlayerId('123456789');

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('getPlayerData', () => {
        test('returns player data when found', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    player_id: '1-123',
                    fleet_id: '9-1',
                    planet_id: '2-5'
                }]
            });

            const result = await getPlayerData('123456789');

            expect(result).toEqual({
                player_id: '1-123',
                fleet_id: '9-1',
                planet_id: '2-5'
            });
        });

        test('returns null when player not found', async () => {
            db.query.mockResolvedValueOnce({
                rows: []
            });

            const result = await getPlayerData('123456789');

            expect(result).toBeNull();
        });
    });

    describe('getPlayerIdWithValidation', () => {
        test('returns player ID when found', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ player_id: '1-123' }]
            });

            const result = await getPlayerIdWithValidation('123456789');

            expect(result).toEqual({ playerId: '1-123' });
            expect(result.error).toBeUndefined();
        });

        test('returns error embed when player not found', async () => {
            db.query.mockResolvedValueOnce({
                rows: []
            });

            const result = await getPlayerIdWithValidation('123456789', 'Custom message');

            expect(result.error).toBeDefined();
            expect(result.playerId).toBeUndefined();
            expect(createWarningEmbed).toHaveBeenCalledWith(
                'Not Registered',
                'Custom message'
            );
        });

        test('uses default message when custom message not provided', async () => {
            db.query.mockResolvedValueOnce({
                rows: []
            });

            const result = await getPlayerIdWithValidation('123456789');

            expect(result.error).toBeDefined();
            expect(createWarningEmbed).toHaveBeenCalledWith(
                'Not Registered',
                expect.stringContaining('not registered')
            );
        });
    });

    describe('getPlayerIdFromAddress', () => {
        test('returns player ID when address found', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ player_id: '1-123' }]
            });

            const result = await getPlayerIdFromAddress('structs1abc...');

            expect(result).toBe('1-123');
            expect(db.query).toHaveBeenCalledWith(
                'SELECT player_id FROM structs.player_address WHERE address = $1 LIMIT 1',
                ['structs1abc...']
            );
        });

        test('returns null when address not found', async () => {
            db.query.mockResolvedValueOnce({
                rows: []
            });

            const result = await getPlayerIdFromAddress('invalid');

            expect(result).toBeNull();
        });
    });

    describe('getDiscordUsername', () => {
        test('returns Discord username when found', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ discord_username: 'testuser' }]
            });

            const result = await getDiscordUsername('1-123');

            expect(result).toBe('testuser');
            expect(db.query).toHaveBeenCalledWith(
                'SELECT discord_username FROM structs.player_discord WHERE player_id = $1',
                ['1-123']
            );
        });

        test('returns null when player not found', async () => {
            db.query.mockResolvedValueOnce({
                rows: []
            });

            const result = await getDiscordUsername('1-999');

            expect(result).toBeNull();
        });
    });

    describe('getPlayerIdFromUsername', () => {
        test('returns player ID when username found', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ player_id: '1-123' }]
            });

            const result = await getPlayerIdFromUsername('testuser');

            expect(result).toBe('1-123');
            expect(db.query).toHaveBeenCalledWith(
                'SELECT player_id FROM structs.player_discord WHERE discord_username = $1',
                ['testuser']
            );
        });

        test('returns null when username not found', async () => {
            db.query.mockResolvedValueOnce({
                rows: []
            });

            const result = await getPlayerIdFromUsername('nonexistent');

            expect(result).toBeNull();
        });
    });
});

