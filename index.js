// Require the necessary discord.js classes
const { Client, Collection, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const natsService = require('./src/services/nats');

// Discord Token
const token = process.env.DISCORD_TOKEN

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
        await natsService.initialize();
        console.log('NATS service initialized');
    } catch (error) {
        console.error('Failed to initialize NATS service:', error);
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

// Log in to Discord with your client's token
client.login(token);