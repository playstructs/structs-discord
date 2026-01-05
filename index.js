// Require the necessary discord.js classes
const { Client, Collection, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const natsService = require('./src/services/nats');
const { initBrowser, closeBrowser } = require('./src/services/imageGenerator');

// Discord Token
const token = process.env.DISCORD_TOKEN

if (!token) {
    console.error('DISCORD_TOKEN is not set in environment variables');
    process.exit(1);
}

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Load commands from src/commands/index.js
client.commands = require('./src/commands');

// When the client is ready, run this code (only once)
client.once('ready', async () => {
    console.log('Bot is ready!');
    try {
        natsService.setDiscordClient(client);
        await natsService.initialize();
        
        // Test NATS connection
        console.log('Testing NATS connection...');
        await natsService.testConnection();
    } catch (error) {
        console.error('Failed to initialize NATS service:', error);
        console.log('Bot will continue running without NATS functionality');
    }
    
    // Initialize Puppeteer browser for image generation
    try {
        console.log('Initializing Puppeteer browser...');
        await initBrowser();
        console.log('Puppeteer browser initialized');
    } catch (error) {
        console.error('Failed to initialize Puppeteer browser:', error);
        console.log('Bot will continue running but /spec command may not work');
    }
});

// Handle interactions
client.on('interactionCreate', async interaction => {
    try {
        // Log all interactions for debugging
        console.log('Received interaction:', interaction.type);
        
        // Handle autocomplete interactions
        if (interaction.isAutocomplete()) {
            console.log('Processing autocomplete interaction for command:', interaction.commandName);
            const command = client.commands.get(interaction.commandName);
            
            if (!command) {
                console.log('Command not found:', interaction.commandName);
                return;
            }
            
            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error('Error in autocomplete:', error);
                await interaction.respond([{ name: '❌ Error occurred', value: 'error' }]);
            }
            return;
        }
        
        // Handle regular command interactions
        if (!interaction.isCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: 'There was an error executing this command!', 
                ephemeral: true 
            });
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
    }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await closeBrowser();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await closeBrowser();
    client.destroy();
    process.exit(0);
});

// Login to Discord with your client's token
client.login(token);