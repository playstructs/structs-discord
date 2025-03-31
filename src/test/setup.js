const db = require('../database');

beforeAll(async () => {
    // Set up test database connection
    // You might want to use a separate test database
    await db.connect();
});

afterAll(async () => {
    // Clean up test database connection
    await db.end();
});

beforeEach(async () => {
    // Clean up test data before each test
    //await db.query('DELETE FROM structs.player_internal_pending');
    //await db.query('DELETE FROM structs.player_meta');
    //await db.query('DELETE FROM structs.guild_meta');
}); 