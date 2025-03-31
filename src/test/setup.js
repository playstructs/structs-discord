const { Pool } = require('pg');
const db = require('../database');

// Create a separate pool for testing
const testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
});

beforeAll(async () => {
    // Set up test database connection
    await testPool.connect();
    console.log('Connected to test database');
});

afterAll(async () => {
    // Clean up test database connection
    await testPool.end();
    console.log('Disconnected from test database');
});

beforeEach(async () => {
    // Clean up test data before each test
    await testPool.query('DELETE FROM structs.player_internal_pending');
    await testPool.query('DELETE FROM structs.player_meta');
    await testPool.query('DELETE FROM structs.guild_meta');
    console.log('Cleaned up test data');
}); 