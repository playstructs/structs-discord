const structCommand = require('../struct');
const db = require('../../database');
const { getPlayerId } = require('../../utils/player');
const { getStructAttribute, formatStructChoice } = require('../../utils/structs');

// Mock the database and utility modules
jest.mock('../../database');
jest.mock('../../utils/player', () => ({
    getPlayerId: jest.fn()
}));
jest.mock('../../utils/structs', () => ({
    getStructAttribute: jest.fn(),
    formatStructChoice: jest.fn()
}));
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
    validatePlayerRegistration: jest.fn((result) => {
        if (!result || result.rows.length === 0) {
            return { title: 'Not Registered', description: 'Please register first' };
        }
        return null;
    })
}));

describe('struct command', () => {
    let mockInteraction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            deferReply: jest.fn(),
            editReply: jest.fn(),
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getInteger: jest.fn()
            },
            user: {
                id: '123456789'
            }
        };
    });

    describe('execute - define subcommand', () => {
        test('successful structure definition', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('define');
            mockInteraction.options.getString
                .mockReturnValueOnce('planet') // category
                .mockReturnValueOnce('16') // ambit
                .mockReturnValueOnce('14'); // struct_type
            mockInteraction.options.getInteger.mockReturnValue(1); // slot

            db.query
                .mockResolvedValueOnce({ rows: [{ player_id: '1-1' }] }) // player lookup
                .mockResolvedValueOnce({ rows: [] }); // transaction

            await structCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT signer.tx_struct_build_initiate'),
                expect.any(Array)
            );
        });
    });

    describe('execute - build subcommand', () => {
        test('successful build', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('build');
            mockInteraction.options.getString.mockReturnValue('5-123'); // struct
            mockInteraction.options.getInteger.mockReturnValue(12345); // nonce

            db.query.mockResolvedValueOnce({ rows: [{ player_id: '1-1' }] }); // player lookup
            getStructAttribute.mockResolvedValue(1000); // build_start_block

            await structCommand.execute(mockInteraction);

            expect(getStructAttribute).toHaveBeenCalledWith('5-123', 'blockStartBuild');
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT signer.tx_struct_build_complete'),
                expect.any(Array)
            );
        });

        test('build data not found - null safety', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('build');
            mockInteraction.options.getString.mockReturnValue('5-123');
            mockInteraction.options.getInteger.mockReturnValue(12345);

            db.query.mockResolvedValueOnce({ rows: [{ player_id: '1-1' }] });
            getStructAttribute.mockResolvedValue(null); // no build data

            await structCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: [expect.objectContaining({
                    title: 'Build Data Not Found'
                })]
            });
        });
    });

    describe('execute - mine subcommand', () => {
        test('successful mining', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('mine');
            mockInteraction.options.getString.mockReturnValue('5-123');
            mockInteraction.options.getInteger.mockReturnValue(12345);

            db.query.mockResolvedValueOnce({ rows: [{ player_id: '1-1' }] });
            getStructAttribute.mockResolvedValue(2000); // mine_start_block

            await structCommand.execute(mockInteraction);

            expect(getStructAttribute).toHaveBeenCalledWith('5-123', 'blockStartOreMine');
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT signer.tx_struct_ore_mine_complete'),
                expect.any(Array)
            );
        });

        test('mining data not found - null safety', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('mine');
            mockInteraction.options.getString.mockReturnValue('5-123');
            mockInteraction.options.getInteger.mockReturnValue(12345);

            db.query.mockResolvedValueOnce({ rows: [{ player_id: '1-1' }] });
            getStructAttribute.mockResolvedValue(null);

            await structCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: [expect.objectContaining({
                    title: 'Mining Data Not Found'
                })]
            });
        });
    });

    describe('execute - refine subcommand', () => {
        test('successful refining', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('refine');
            mockInteraction.options.getString.mockReturnValue('5-123');
            mockInteraction.options.getInteger.mockReturnValue(12345);

            db.query.mockResolvedValueOnce({ rows: [{ player_id: '1-1' }] });
            getStructAttribute.mockResolvedValue(3000); // refine_start_block

            await structCommand.execute(mockInteraction);

            expect(getStructAttribute).toHaveBeenCalledWith('5-123', 'blockStartOreRefine');
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT signer.tx_struct_ore_refine_complete'),
                expect.any(Array)
            );
        });

        test('refining data not found - null safety', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('refine');
            mockInteraction.options.getString.mockReturnValue('5-123');
            mockInteraction.options.getInteger.mockReturnValue(12345);

            db.query.mockResolvedValueOnce({ rows: [{ player_id: '1-1' }] });
            getStructAttribute.mockResolvedValue(null);

            await structCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: [expect.objectContaining({
                    title: 'Refining Data Not Found'
                })]
            });
        });
    });

    describe('execute - error handling', () => {
        test('handles database errors', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('activate');
            mockInteraction.options.getString.mockReturnValue('5-123');

            db.query.mockRejectedValueOnce(new Error('Database connection failed'));

            await structCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: [expect.objectContaining({
                    title: 'Error'
                })]
            });
        });

        test('handles player not registered', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('define');

            db.query.mockResolvedValueOnce({ rows: [] }); // no player

            await structCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
        });
    });

    describe('autocomplete', () => {
        let mockAutocompleteInteraction;

        beforeEach(() => {
            mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn(() => ({ name: 'struct' })),
                    getSubcommand: jest.fn()
                },
                user: {
                    id: '123456789'
                },
                respond: jest.fn()
            };
        });

        test('build subcommand autocomplete', async () => {
            mockAutocompleteInteraction.options.getSubcommand.mockReturnValue('build');
            mockAutocompleteInteraction.options.getFocused.mockReturnValue('test');
            getPlayerId.mockResolvedValue('1-1');

            db.query.mockResolvedValueOnce({
                rows: [
                    { name: '5-123 Command Ship', ambit: 16, icon: 'COMMAND_SHIP', value: '5-123' }
                ]
            });

            formatStructChoice.mockReturnValue({
                name: '🚀 5-123 Command Ship 🌌',
                value: '5-123'
            });

            await structCommand.autocomplete(mockAutocompleteInteraction);

            expect(getPlayerId).toHaveBeenCalledWith('123456789');
            expect(formatStructChoice).toHaveBeenCalled();
            expect(mockAutocompleteInteraction.respond).toHaveBeenCalled();
        });

        test('autocomplete handles no player', async () => {
            mockAutocompleteInteraction.options.getSubcommand.mockReturnValue('build');
            getPlayerId.mockResolvedValue(null);

            await structCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).not.toHaveBeenCalled();
        });

        test('autocomplete error handling', async () => {
            mockAutocompleteInteraction.options.getSubcommand.mockReturnValue('build');
            getPlayerId.mockRejectedValue(new Error('Database error'));

            await structCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([]);
        });
    });
});

