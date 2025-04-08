const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// Check for required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    console.error('Please check your .env file and make sure all required variables are set.');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log(`📂 Found ${commandFiles.length} command files in ${commandsPath}`);

// Load commands from files
for (const file of commandFiles) {
    if (file === 'index.js') continue; // Skip the index.js file
    
    const filePath = path.join(commandsPath, file);
    try {
        const command = require(filePath);
        
        // Validate command structure
        if (!('data' in command)) {
            console.warn(`⚠️ The command at ${file} is missing a required "data" property.`);
            continue;
        }
        
        if (!('execute' in command)) {
            console.warn(`⚠️ The command at ${file} is missing a required "execute" function.`);
            continue;
        }
        
        // Check if the command has autocomplete but no autocomplete handler
        const hasAutocompleteOption = command.data.options.some(option => option.autocomplete === true);
        if (hasAutocompleteOption && !('autocomplete' in command)) {
            console.warn(`⚠️ The command at ${file} has autocomplete options but no autocomplete handler.`);
        }
        
        commands.push(command.data.toJSON());
        console.log(`✅ Loaded command: ${command.data.name}`);
    } catch (error) {
        console.error(`❌ Error loading command from ${file}:`, error);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands
        const data = await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
        console.log('📝 Commands deployed:');
        data.forEach(cmd => console.log(`   - /${cmd.name}`));
    } catch (error) {
        console.error('❌ Error deploying commands:');
        if (error.code) {
            console.error(`   Code: ${error.code}`);
        }
        if (error.status) {
            console.error(`   Status: ${error.status}`);
        }
        if (error.message) {
            console.error(`   Message: ${error.message}`);
        }
        if (error.requestBody) {
            console.error('   Request body:', JSON.stringify(error.requestBody, null, 2));
        }
        process.exit(1);
    }
})(); 