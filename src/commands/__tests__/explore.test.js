const exploreCommand = require('../explore');
const db = require('../../database');
const { getPlayerIdWithValidation } = require('../../utils/player');

// Mock the database and utility modules
jest.mock('../../database');
jest.mock('../../utils/player', () => ({
    getPlayerIdWithValidation: jest.fn()
}));
jest.mock('../../utils/errors', () => ({
    handleError: jest.fn((error, context) => ({
        embed: { title: 'Error', description: error.message }
    })),
    createSuccessEmbed: jest.fn((title, description, fields) => ({
        title,
        description,
        fields: fields || []
    }))
}));

describe('explore command', () => {
    let mockInteraction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            deferReply: jest.fn().mockResolvedValue(),
            editReply: jest.fn().mockResolvedValue(),
            user: {
                id: '123456789',
                username: 'testuser'
            }
        };
    });

    describe('execute', () => {
        test('should successfully submit exploration request when player is registered', async () => {
            // Mock successful player validation
            getPlayerIdWithValidation.mockResolvedValue({
                playerId: '1-123'
            });

            // Mock successful database query
            db.query.mockResolvedValue({ rows: [] });

            const { createSuccessEmbed } = require('../../utils/errors');
            createSuccessEmbed.mockReturnValue({
                title: 'Exploration Request Submitted',
                description: 'Your exploration request has been submitted for processing. You will be assigned a new planet.',
                fields: [{ name: 'Player ID', value: '1-123', inline: true }]
            });

            await exploreCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(getPlayerIdWithValidation).toHaveBeenCalledWith(
                '123456789',
                'You are not registered as a player. Please use `/join` to join a guild first.'
            );
            expect(db.query).toHaveBeenCalledWith(
                'SELECT signer.tx_explore($1)',
                ['1-123']
            );
            expect(createSuccessEmbed).toHaveBeenCalledWith(
                'Exploration Request Submitted',
                'Your exploration request has been submitted for processing. You will be assigned a new planet.',
                [{ name: 'Player ID', value: '1-123', inline: true }]
            );
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });

        test('should return error embed when player is not registered', async () => {
            // Mock player not found
            const errorEmbed = {
                title: 'Not Registered',
                description: 'You are not registered as a player. Please use `/join` to join a guild first.'
            };
            getPlayerIdWithValidation.mockResolvedValue({
                error: errorEmbed
            });

            await exploreCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(getPlayerIdWithValidation).toHaveBeenCalled();
            expect(db.query).not.toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith({ embeds: [errorEmbed] });
        });

        test('should handle database errors gracefully', async () => {
            // Mock successful player validation
            getPlayerIdWithValidation.mockResolvedValue({
                playerId: '1-123'
            });

            // Mock database error
            const dbError = new Error('Database connection failed');
            db.query.mockRejectedValue(dbError);

            const { handleError } = require('../../utils/errors');
            handleError.mockReturnValue({
                embed: { title: 'Error', description: 'Database connection failed' }
            });

            await exploreCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(getPlayerIdWithValidation).toHaveBeenCalled();
            expect(db.query).toHaveBeenCalled();
            expect(handleError).toHaveBeenCalledWith(dbError, 'explore command', mockInteraction);
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });

        test('should handle transaction function errors', async () => {
            // Mock successful player validation
            getPlayerIdWithValidation.mockResolvedValue({
                playerId: '1-123'
            });

            // Mock transaction error
            const txError = new Error('Transaction failed: Invalid player state');
            db.query.mockRejectedValue(txError);

            const { handleError } = require('../../utils/errors');
            handleError.mockReturnValue({
                embed: { title: 'Error', description: 'Transaction failed: Invalid player state' }
            });

            await exploreCommand.execute(mockInteraction);

            expect(handleError).toHaveBeenCalledWith(txError, 'explore command', mockInteraction);
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });
    });
});
