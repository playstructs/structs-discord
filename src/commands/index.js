const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

const commands = new Collection();

// Load all command files from the commands directory
const commandsPath = path.join(__dirname);
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') && file !== 'index.js');

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

module.exports = commands; 