const fleetCommand = require('../fleet');
const db = require('../../database');
const { validatePlayerRegistration } = require('../../utils/errors');

// Mock the database and utility modules
jest.mock('../../database');
jest.mock('../../utils/errors', () => ({
    handleError: jest.fn((error, context) => ({
        embed: { title: 'Error', description: error.message }
    })),
    createSuccessEmbed: jest.fn((title, description, fields) => ({
        title,
        description,
        fields: fields || []
    })),
    createWarningEmbed: jest.fn((title, description) => ({
        title,
        description
    })),
    validatePlayerRegistration: jest.fn((result, message) => {
        if (!result || result.rows.length === 0) {
            return { title: 'Not Registered', description: message || 'Please register first' };
        }
        return null;
    })
}));

describe('fleet command', () => {
    let mockInteraction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            deferReply: jest.fn(),
            editReply: jest.fn(),
            respond: jest.fn(),
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getFocused: jest.fn()
            },
            user: {
                id: '123456789'
            }
        };
    });

    describe('autocomplete', () => {
        it('should return deployment destination choices', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('deploy');
            mockInteraction.options.getFocused.mockReturnValue('test');

            db.query.mockResolvedValue({
                rows: [
                    { name: '@testuser', value: '2-1' },
                    { name: '2-2 owner', value: '2-2' }
                ]
            });

            await fleetCommand.autocomplete(mockInteraction);

            expect(db.query).toHaveBeenCalled();
            expect(mockInteraction.respond).toHaveBeenCalledWith([
                { name: '@testuser', value: '2-1' },
                { name: '2-2 owner', value: '2-2' }
            ]);
        });

        it('should handle autocomplete errors gracefully', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('deploy');
            mockInteraction.options.getFocused.mockReturnValue('test');

            db.query.mockRejectedValue(new Error('Database error'));

            await fleetCommand.autocomplete(mockInteraction);

            expect(mockInteraction.respond).toHaveBeenCalledWith([]);
        });
    });

    describe('execute - deploy', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('deploy');
            mockInteraction.options.getString.mockReturnValue('2-1');
        });

        it('should successfully deploy fleet', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{ player_id: '1-123', fleet_id: '9-1' }]
                })
                .mockResolvedValueOnce({ rows: [] });

            validatePlayerRegistration.mockReturnValue(null);

            await fleetCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(db.query).toHaveBeenCalledWith(
                'SELECT signer.tx_fleet_move($1, $2, $3)',
                ['1-123', '9-1', '2-1']
            );
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });

        it('should handle unregistered player', async () => {
            db.query.mockResolvedValue({
                rows: []
            });

            validatePlayerRegistration.mockReturnValue({
                title: 'Not Registered',
                description: 'You are not registered as a player.'
            });

            await fleetCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: [{ title: 'Not Registered', description: 'You are not registered as a player.' }]
            });
        });

        it('should handle player with no fleet', async () => {
            db.query.mockResolvedValue({
                rows: [{ player_id: '1-123', fleet_id: null }]
            });

            validatePlayerRegistration.mockReturnValue(null);

            await fleetCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
            const callArgs = mockInteraction.editReply.mock.calls[0][0];
            expect(callArgs.embeds[0].title).toBe('No Fleet');
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database connection failed'));

            await fleetCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
        });
    });

    describe('execute - return', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('return');
        });

        it('should successfully return fleet', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{ player_id: '1-123', fleet_id: '9-1', planet_id: '2-1' }]
                })
                .mockResolvedValueOnce({ rows: [] });

            validatePlayerRegistration.mockReturnValue(null);

            await fleetCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(db.query).toHaveBeenCalledWith(
                'SELECT signer.tx_fleet_move($1, $2, $3)',
                ['1-123', '9-1', '2-1']
            );
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });

        it('should handle player with no fleet', async () => {
            db.query.mockResolvedValue({
                rows: [{ player_id: '1-123', fleet_id: null, planet_id: '2-1' }]
            });

            validatePlayerRegistration.mockReturnValue(null);

            await fleetCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
            const callArgs = mockInteraction.editReply.mock.calls[0][0];
            expect(callArgs.embeds[0].title).toBe('No Fleet');
        });

        it('should handle player with no planet', async () => {
            db.query.mockResolvedValue({
                rows: [{ player_id: '1-123', fleet_id: '9-1', planet_id: null }]
            });

            validatePlayerRegistration.mockReturnValue(null);

            await fleetCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
            const callArgs = mockInteraction.editReply.mock.calls[0][0];
            expect(callArgs.embeds[0].title).toBe('No Planet');
        });
    });
});

