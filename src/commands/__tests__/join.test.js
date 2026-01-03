const joinCommand = require('../join');
const db = require('../../database');

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
    }))
}));

describe('join command', () => {
    let mockInteraction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            deferReply: jest.fn(),
            editReply: jest.fn(),
            respond: jest.fn(),
            options: {
                getString: jest.fn(),
                getFocused: jest.fn()
            },
            user: {
                id: '123456789',
                username: 'testuser'
            }
        };
    });

    describe('autocomplete', () => {
        it('should return default suggestion when input is empty', async () => {
            mockInteraction.options.getFocused.mockReturnValue('');

            await joinCommand.autocomplete(mockInteraction);

            expect(mockInteraction.respond).toHaveBeenCalledWith([
                { name: '🔍 Type to search for a guild', value: 'search' }
            ]);
        });

        it('should return guild search results', async () => {
            mockInteraction.options.getFocused.mockReturnValue('test');

            db.query.mockResolvedValue({
                rows: [
                    { name: '0-1', value: '0-1' },
                    { name: 'Test Guild(0-2)', value: '0-2' },
                    { name: 'TG(0-3)', value: '0-3' }
                ]
            });

            await joinCommand.autocomplete(mockInteraction);

            expect(db.query).toHaveBeenCalled();
            expect(mockInteraction.respond).toHaveBeenCalledWith([
                { name: '🏰 0-1', value: '0-1' },
                { name: '🏰 Test Guild(0-2)', value: '0-2' },
                { name: '🏰 TG(0-3)', value: '0-3' }
            ]);
        });

        it('should return no results message when no guilds found', async () => {
            mockInteraction.options.getFocused.mockReturnValue('nonexistent');

            db.query.mockResolvedValue({
                rows: []
            });

            await joinCommand.autocomplete(mockInteraction);

            expect(mockInteraction.respond).toHaveBeenCalledWith([
                { name: '🔍 No guilds found. Try a different search term.', value: 'no-results' }
            ]);
        });

        it('should handle autocomplete errors gracefully', async () => {
            mockInteraction.options.getFocused.mockReturnValue('test');

            db.query.mockRejectedValue(new Error('Database error'));

            await joinCommand.autocomplete(mockInteraction);

            expect(mockInteraction.respond).toHaveBeenCalledWith([
                { name: '❌ Error occurred during search', value: 'error' }
            ]);
        });
    });

    describe('execute', () => {
        it('should successfully submit join request with guild ID', async () => {
            mockInteraction.options.getString.mockReturnValue('0-1');

            db.query
                .mockResolvedValueOnce({ rows: [] }) // Player check - not found
                .mockResolvedValueOnce({ rows: [] }) // Pending check - no pending
                .mockResolvedValueOnce({ rows: [] }); // Insert

            await joinCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(db.query).toHaveBeenCalledWith(
                'INSERT INTO structs.player_discord(guild_id, discord_id, discord_username) VALUES ($1, $2, $3)',
                ['0-1', '123456789', 'testuser']
            );
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });

        it('should successfully submit join request with guild tag', async () => {
            mockInteraction.options.getString.mockReturnValue('TG');

            db.query
                .mockResolvedValueOnce({ rows: [] }) // Player check
                .mockResolvedValueOnce({ rows: [{ id: '0-1' }] }) // Guild lookup by tag
                .mockResolvedValueOnce({ rows: [] }) // Pending check
                .mockResolvedValueOnce({ rows: [] }); // Insert

            await joinCommand.execute(mockInteraction);

            expect(db.query).toHaveBeenCalledWith(
                'SELECT id FROM structs.guild_meta WHERE tag = $1',
                ['TG']
            );
            expect(db.query).toHaveBeenCalledWith(
                'INSERT INTO structs.player_discord(guild_id, discord_id, discord_username) VALUES ($1, $2, $3)',
                ['0-1', '123456789', 'testuser']
            );
        });

        it('should handle already registered player', async () => {
            mockInteraction.options.getString.mockReturnValue('0-1');

            db.query.mockResolvedValue({
                rows: [{ player_id: '1-123' }]
            });

            await joinCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
            const callArgs = mockInteraction.editReply.mock.calls[0][0];
            expect(callArgs.embeds[0].title).toBe('Already Registered');
        });

        it('should handle pending join request', async () => {
            mockInteraction.options.getString.mockReturnValue('0-1');

            db.query
                .mockResolvedValueOnce({ rows: [] }) // Player check
                .mockResolvedValueOnce({ rows: [{ id: 'role-1' }] }); // Pending check

            await joinCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
            const callArgs = mockInteraction.editReply.mock.calls[0][0];
            expect(callArgs.embeds[0].title).toBe('Pending Request');
        });

        it('should handle invalid guild selection (no-results)', async () => {
            mockInteraction.options.getString.mockReturnValue('no-results');

            await joinCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
            const callArgs = mockInteraction.editReply.mock.calls[0][0];
            expect(callArgs.embeds[0].title).toBe('Invalid Selection');
        });

        it('should handle invalid guild selection (error)', async () => {
            mockInteraction.options.getString.mockReturnValue('error');

            await joinCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
            const callArgs = mockInteraction.editReply.mock.calls[0][0];
            expect(callArgs.embeds[0].title).toBe('Invalid Selection');
        });

        it('should handle guild not found by tag', async () => {
            mockInteraction.options.getString.mockReturnValue('INVALID');

            db.query
                .mockResolvedValueOnce({ rows: [] }) // Player check
                .mockResolvedValueOnce({ rows: [] }); // Guild lookup - not found

            await joinCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
            const callArgs = mockInteraction.editReply.mock.calls[0][0];
            expect(callArgs.embeds[0].title).toBe('Guild Not Found');
        });

        it('should handle database errors', async () => {
            mockInteraction.options.getString.mockReturnValue('0-1');

            db.query.mockRejectedValue(new Error('Database connection failed'));

            await joinCommand.execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalled();
        });
    });
});

