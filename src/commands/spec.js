const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createWarningEmbed } = require('../utils/errors');
const { fetchStructTypeData } = require('../queries/structTypes');
const { generateCheatsheetImage, initBrowser } = require('../services/imageGenerator');
const CheatsheetBuilder = require('../builders/cheatsheetBuilder');

/**
 * Spec command module
 * @module commands/spec
 * @description View struct type specifications and stats with visual cheatsheet
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('spec')
        .setDescription('View struct type specifications and stats')
        .addStringOption(option =>
            option
                .setName('struct_type')
                .setDescription('Select a struct type')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    /**
     * Autocomplete handler for spec command
     * @param {Object} interaction - Discord autocomplete interaction
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            const structTypes = await fetchStructTypeData.forAutocomplete(focusedValue);

            const choices = structTypes.map(row => {
                const emojiKey = row.icon;
                const emoji = EMOJIS[emojiKey] || '🏗️';
                return {
                    name: `${emoji} ${row.type}`,
                    value: row.id.toString()
                };
            });

            await interaction.respond(choices);
        } catch (error) {
            console.error('Error in spec autocomplete:', error);
            await interaction.respond([]);
        }
    },

    /**
     * Execute handler for spec command
     * @param {Object} interaction - Discord slash command interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const structTypeId = interaction.options.getString('struct_type');

            // Fetch struct type data
            const structTypeData = await fetchStructTypeData.byId(structTypeId);

            if (!structTypeData) {
                return await interaction.editReply({
                    embeds: [createWarningEmbed(
                        'Struct Type Not Found',
                        'The specified struct type was not found.'
                    )]
                });
            }

            // Initialize browser if not already done
            await initBrowser();

            // Build cheatsheet HTML
            const cheatsheetBuilder = new CheatsheetBuilder();
            const htmlContent = await cheatsheetBuilder.buildStructCheatsheet(structTypeData);

            // Generate image
            const imageBuffer = await generateCheatsheetImage(htmlContent, {
                width: 800,
                format: 'png'
            });

            // Create attachment
            const attachment = new AttachmentBuilder(imageBuffer, {
                name: `spec-${structTypeData.type.replace(/\s+/g, '-').toLowerCase()}.png`,
                description: `Specifications for ${structTypeData.type}`
            });

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle(`${EMOJIS.STRUCT?.PLANETARY || '🏗️'} ${structTypeData.type} Specifications`)
                .setDescription(`**${structTypeData.class || structTypeData.type}**`)
                .setImage(`attachment://${attachment.name}`)
                .setColor(0x00AE86) // SUI primary color
                .setFooter({ text: 'Structs Discord Bot' });

            await interaction.editReply({
                embeds: [embed],
                files: [attachment]
            });
        } catch (error) {
            console.error('Error in spec command:', error);
            const { embed } = handleError(error, 'spec command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

