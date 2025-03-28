const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Provides Details about Structs'),
    async execute(interaction) {
        await interaction.reply('Pong!');
    },
};