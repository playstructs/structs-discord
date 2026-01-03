const { SlashCommandBuilder } = require('@discordjs/builders');
const structCommand = require('../struct');
const { execute, autocomplete } = structCommand;
const db = require('../../database');

// Mock the database and query modules
jest.mock('../../database');
jest.mock('../../queries/structs');
jest.mock('../../embeds/structs');

describe('structs command', () => {
    let mockInteraction;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Create a mock interaction
        mockInteraction = {
            deferReply: jest.fn(),
            editReply: jest.fn(),
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getFocused: jest.fn()
            },
            user: {
                username: 'testUser'
            }
        };
    });

    describe('execute', () => {
        test('lookup subcommand - valid ID', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('lookup');
            mockInteraction.options.getString.mockReturnValue('1-123');
            
            fetchPlayerData.byId.mockResolvedValue({
                rows: [{ id: '1-123', username: 'testUser' }]
            });
            createEmbeds.player.mockResolvedValue([{ title: 'Player Info' }]);

            await execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(fetchPlayerData.byId).toHaveBeenCalledWith('1-123');
            expect(createEmbeds.player).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith({ embeds: [{ title: 'Player Info' }] });
        });

        test('join subcommand - successful join', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('join');
            mockInteraction.options.getString.mockReturnValue('0-123');

            // Mock database queries
            db.query
                .mockResolvedValueOnce({ rows: [] }) // playerCheck
                .mockResolvedValueOnce({ rows: [] }) // pendingCheck
                .mockResolvedValueOnce({ rows: [] }); // insert

            await execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(db.query).toHaveBeenCalledTimes(3);
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('Your join request has been submitted')
            );
        });

        test('join subcommand - already registered', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('join');
            mockInteraction.options.getString.mockReturnValue('0-123');

            // Mock player already exists
            db.query.mockResolvedValueOnce({ rows: [{ username: 'testUser' }] });

            await execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'You are already registered as a player.'
            );
        });

        test('join subcommand - pending request exists', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('join');
            mockInteraction.options.getString.mockReturnValue('0-123');

            // Mock pending request exists
            db.query
                .mockResolvedValueOnce({ rows: [] }) // playerCheck
                .mockResolvedValueOnce({ rows: [{ discord_username: 'testUser' }] }); // pendingCheck

            await execute(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'You already have a pending join request. Please wait for it to be processed.'
            );
        });
    });

    describe('autocomplete', () => {
        test('join subcommand - guild autocomplete', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('join');
            mockInteraction.options.getFocused.mockReturnValue('test');

            const mockGuilds = [
                { id: '0-1', name: 'Test Guild 1' },
                { id: '0-2', name: 'Test Guild 2' }
            ];

            db.query.mockResolvedValueOnce({ rows: mockGuilds });
            mockInteraction.respond = jest.fn();

            await autocomplete(mockInteraction);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id, name FROM structs.guild_meta'),
                ['%test%']
            );
            expect(mockInteraction.respond).toHaveBeenCalledWith(
                mockGuilds.map(guild => ({
                    name: guild.name,
                    value: guild.id
                }))
            );
        });
    });
}); 