const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { EMOJIS } = require('../constants/emojis');
const { handleError, createInfoEmbed } = require('../utils/errors');

/**
 * Dev command module
 * @module commands/dev
 * @description Provides developer resources including documentation links, API references, and NATS subscriptions
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('dev')
        .setDescription('Developer resources and documentation for Structs')
        .addSubcommand(subcommand =>
            subcommand
                .setName('compendium')
                .setDescription('Links to the Structs Compendium documentation')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('repos')
                .setDescription('Links to Structs repositories')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('api')
                .setDescription('API documentation and quick reference')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('schemas')
                .setDescription('Entity schemas and data structures')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('examples')
                .setDescription('Code examples and bot implementations')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('quickstart')
                .setDescription('Quick start guide for developers')
        ),

    /**
     * Execute handler for dev command
     * @param {Object} interaction - Discord slash command interaction
     * @param {Object} interaction.user - Discord user object
     * @param {string} interaction.user.id - Discord user ID
     * @param {Function} interaction.deferReply - Defer the reply
     * @param {Function} interaction.editReply - Edit the deferred reply
     * @param {Object} interaction.options - Interaction options
     * @param {Function} interaction.options.getSubcommand - Get selected subcommand
     * @param {Function} interaction.options.getString - Get string option values
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        try {
            let embed;

            switch (subcommand) {
                case 'compendium': {
                    embed = new EmbedBuilder()
                        .setTitle(`${EMOJIS.STATUS.INFO} Structs Compendium`)
                        .setColor('#0099ff')
                        .setDescription('Comprehensive documentation for the Structs game system')
                        .addFields(
                            {
                                name: '📚 Main Repository',
                                value: '[structs-compendium](https://github.com/playstructs/structs-compendium)',
                                inline: false
                            },
                            {
                                name: '🚀 Quick Start',
                                value: '• [Agent Guide](https://github.com/playstructs/structs-compendium/blob/main/AGENTS.md) - Start here for AI agents\n' +
                                       '• [Loading Strategy](https://github.com/playstructs/structs-compendium/blob/main/LOADING_STRATEGY.md) - Efficient documentation loading',
                                inline: false
                            },
                            {
                                name: '📖 Documentation Sections',
                                value: '• **Schemas** - Entity definitions and data structures\n' +
                                       '• **Protocols** - Query, action, and error handling patterns\n' +
                                       '• **API** - Complete API reference (1180+ endpoints)\n' +
                                       '• **Examples** - Bot implementations and workflows\n' +
                                       '• **Guides** - Step-by-step tutorials\n' +
                                       '• **Reference** - Quick reference materials',
                                inline: false
                            },
                            {
                                name: '🔍 Quick Reference',
                                value: '• [API Quick Reference](https://github.com/playstructs/structs-compendium/tree/main/reference/api-quick-reference.md)\n' +
                                       '• [Action Quick Reference](https://github.com/playstructs/structs-compendium/tree/main/reference/action-quick-reference.md)\n' +
                                       '• [Endpoint Index](https://github.com/playstructs/structs-compendium/tree/main/reference/endpoint-index.json)',
                                inline: false
                            }
                        )
                        .setFooter({ text: 'The Structs Compendium - Complete game system documentation' })
                        .setTimestamp();
                    break;
                }
                case 'repos': {
                    embed = new EmbedBuilder()
                        .setTitle(`${EMOJIS.STATUS.INFO} Structs Repositories`)
                        .setColor('#0099ff')
                        .setDescription('Official Structs repositories and resources')
                        .addFields(
                            {
                                name: '📚 Documentation',
                                value: '• [structs-compendium](https://github.com/playstructs/structs-compendium) - Complete game documentation\n' +
                                       '• [structs-discord](https://github.com/playstructs/structs-discord) - Discord bot (this repo)',
                                inline: false
                            },
                            {
                                name: '🔧 Development',
                                value: '• Check the compendium for links to game client repos\n' +
                                       '• API documentation in compendium\n' +
                                       '• Schema definitions in compendium',
                                inline: false
                            },
                            {
                                name: '💡 Contributing',
                                value: '• Report issues on repository issue trackers\n' +
                                       '• Follow repository contribution guidelines\n' +
                                       '• Check documentation before asking questions',
                                inline: false
                            }
                        )
                        .setFooter({ text: 'All repositories are part of the Structs ecosystem' })
                        .setTimestamp();
                    break;
                }
                case 'api': {
                    embed = new EmbedBuilder()
                        .setTitle(`${EMOJIS.STATUS.INFO} API Documentation`)
                        .setColor('#0099ff')
                        .setDescription('API reference and transaction documentation')
                        .addFields(
                            {
                                name: '📖 Compendium Resources',
                                value: '• [API Endpoints](https://github.com/playstructs/structs-compendium/tree/main/api) - Complete API reference\n' +
                                       '• [Query Protocol](https://github.com/playstructs/structs-compendium/tree/main/protocols/query-protocol.md) - Query patterns\n' +
                                       '• [Action Protocol](https://github.com/playstructs/structs-compendium/tree/main/protocols/action-protocol.md) - Action patterns\n' +
                                       '• [Transaction API](https://github.com/playstructs/structs-compendium/tree/main/api/transactions) - Transaction examples',
                                inline: false
                            },
                            {
                                name: '🔧 Discord Bot API',
                                value: '• [API Reference](docs/API_REFERENCE.md) - Database transaction functions\n' +
                                       '• [Code Examples](docs/CODE_EXAMPLES.md) - Implementation examples\n' +
                                       '• [Quick Reference](docs/QUICK_REFERENCE.md) - Code snippets',
                                inline: false
                            },
                            {
                                name: '📊 Entity Queries',
                                value: '• Player queries: `api/queries/player.yaml`\n' +
                                       '• Planet queries: `api/queries/planet.yaml`\n' +
                                       '• Struct queries: `api/queries/struct.yaml`\n' +
                                       '• See [Endpoint Index](https://github.com/playstructs/structs-compendium/tree/main/reference/endpoint-index.json) for all queries',
                                inline: false
                            },
                            {
                                name: '⚡ Quick Links',
                                value: '• [API Quick Reference](https://github.com/playstructs/structs-compendium/tree/main/reference/api-quick-reference.md)\n' +
                                       '• [All Endpoints](https://github.com/playstructs/structs-compendium/tree/main/api/endpoints.yaml)',
                                inline: false
                            }
                        )
                        .setFooter({ text: 'Use /dev compendium for full documentation links' })
                        .setTimestamp();
                    break;
                }
                case 'schemas': {
                    embed = new EmbedBuilder()
                        .setTitle(`${EMOJIS.STATUS.INFO} Entity Schemas`)
                        .setColor('#0099ff')
                        .setDescription('Data structures and entity definitions')
                        .addFields(
                            {
                                name: '📋 Core Schemas',
                                value: '• [Game State](https://github.com/playstructs/structs-compendium/tree/main/schemas/game-state.json) - Complete state structure\n' +
                                       '• [Entities](https://github.com/playstructs/structs-compendium/tree/main/schemas/entities.json) - All entity definitions\n' +
                                       '• [Economics](https://github.com/playstructs/structs-compendium/tree/main/schemas/economics.json) - Economic entities and formulas\n' +
                                       '• [Gameplay](https://github.com/playstructs/structs-compendium/tree/main/schemas/gameplay.json) - Gameplay mechanics',
                                inline: false
                            },
                            {
                                name: '🎯 Entity Types',
                                value: '• **0** = Guild\n' +
                                       '• **1** = Player\n' +
                                       '• **2** = Planet\n' +
                                       '• **3** = Reactor\n' +
                                       '• **4** = Substation\n' +
                                       '• **5** = Struct\n' +
                                       '• **6** = Allocation\n' +
                                       '• **7** = Infusion\n' +
                                       '• **8** = Address\n' +
                                       '• **9** = Fleet\n' +
                                       '• **10** = Provider\n' +
                                       '• **11** = Agreement',
                                inline: false
                            },
                            {
                                name: '📝 ID Format',
                                value: 'Entity IDs use format: `type-index`\n' +
                                       '• Example: `1-11` = Player 11\n' +
                                       '• Example: `5-76` = Struct 76\n' +
                                       '• See [ID Format Spec](https://github.com/playstructs/structs-compendium#id-format-specification)',
                                inline: false
                            },
                            {
                                name: '🔍 Find Schemas',
                                value: '• [Schema Directory](https://github.com/playstructs/structs-compendium/tree/main/schemas)\n' +
                                       '• [Entity Index](https://github.com/playstructs/structs-compendium/tree/main/reference/entity-index.json)',
                                inline: false
                            }
                        )
                        .setFooter({ text: 'All schemas use JSON Schema Draft 7 format' })
                        .setTimestamp();
                    break;
                }
                case 'examples': {
                    embed = new EmbedBuilder()
                        .setTitle(`${EMOJIS.STATUS.INFO} Code Examples`)
                        .setColor('#0099ff')
                        .setDescription('Example bot implementations and workflows')
                        .addFields(
                            {
                                name: '🤖 Bot Examples',
                                value: '• [Simple Bot](https://github.com/playstructs/structs-compendium/tree/main/examples/simple-bot.json)\n' +
                                       '• [Mining Bot](https://github.com/playstructs/structs-compendium/tree/main/examples/gameplay-mining-bot.json)\n' +
                                       '• [Combat Bot](https://github.com/playstructs/structs-compendium/tree/main/examples/gameplay-combat-bot.json)\n' +
                                       '• [Economic Bot](https://github.com/playstructs/structs-compendium/tree/main/examples/economic-bot.json)',
                                inline: false
                            },
                            {
                                name: '📚 Discord Bot Examples',
                                value: '• [Developer Guide](docs/DEVELOPER_GUIDE.md) - Adding commands\n' +
                                       '• [Code Examples](docs/CODE_EXAMPLES.md) - Implementation patterns\n' +
                                       '• [Quick Reference](docs/QUICK_REFERENCE.md) - Code snippets',
                                inline: false
                            },
                            {
                                name: '🔄 Workflow Examples',
                                value: '• [Workflow Patterns](https://github.com/playstructs/structs-compendium/tree/main/workflows)\n' +
                                       '• [Lifecycle Examples](https://github.com/playstructs/structs-compendium/tree/main/lifecycles)',
                                inline: false
                            },
                            {
                                name: '📖 All Examples',
                                value: '• [Examples Directory](https://github.com/playstructs/structs-compendium/tree/main/examples)',
                                inline: false
                            }
                        )
                        .setFooter({ text: 'Examples are in JSON format for easy parsing' })
                        .setTimestamp();
                    break;
                }
                case 'quickstart': {
                    embed = new EmbedBuilder()
                        .setTitle(`${EMOJIS.STATUS.INFO} Developer Quick Start`)
                        .setColor('#0099ff')
                        .setDescription('Get started building on Structs')
                        .addFields(
                            {
                                name: '🚀 Step 1: Read the Guides',
                                value: '• [Agent Guide](https://github.com/playstructs/structs-compendium/blob/main/AGENTS.md) - Comprehensive AI agent guide\n' +
                                       '• [Loading Strategy](https://github.com/playstructs/structs-compendium/blob/main/LOADING_STRATEGY.md) - Efficient documentation loading',
                                inline: false
                            },
                            {
                                name: '📊 Step 2: Understand Game State',
                                value: '• [Game State Schema](https://github.com/playstructs/structs-compendium/tree/main/schemas/game-state.json)\n' +
                                       '• [Entities Schema](https://github.com/playstructs/structs-compendium/tree/main/schemas/entities.json)\n' +
                                       '• [Economics Schema](https://github.com/playstructs/structs-compendium/tree/main/schemas/economics.json)',
                                inline: false
                            },
                            {
                                name: '🔍 Step 3: Learn to Query',
                                value: '• [Query Protocol](https://github.com/playstructs/structs-compendium/tree/main/protocols/query-protocol.md)\n' +
                                       '• [Entity Queries](https://github.com/playstructs/structs-compendium/tree/main/api/queries)\n' +
                                       '• [Endpoint Index](https://github.com/playstructs/structs-compendium/tree/main/reference/endpoint-index.json)',
                                inline: false
                            },
                            {
                                name: '⚡ Step 4: Learn to Act',
                                value: '• [Action Protocol](https://github.com/playstructs/structs-compendium/tree/main/protocols/action-protocol.md)\n' +
                                       '• [Transaction API](https://github.com/playstructs/structs-compendium/tree/main/api/transactions)\n' +
                                       '• [Action Quick Reference](https://github.com/playstructs/structs-compendium/tree/main/reference/action-quick-reference.md)',
                                inline: false
                            },
                            {
                                name: '📖 Step 5: Review Examples',
                                value: '• [Bot Examples](https://github.com/playstructs/structs-compendium/tree/main/examples)\n' +
                                       '• [Workflow Examples](https://github.com/playstructs/structs-compendium/tree/main/workflows)\n' +
                                       '• [Discord Bot Docs](docs/DEVELOPER_GUIDE.md)',
                                inline: false
                            },
                            {
                                name: '🔗 Quick Links',
                                value: '• [Compendium](https://github.com/playstructs/structs-compendium)\n' +
                                       '• [Discord Bot Repo](https://github.com/playstructs/structs-discord)\n' +
                                       '• Use `/dev compendium` for more resources',
                                inline: false
                            }
                        )
                        .setFooter({ text: 'Start with the Agent Guide for comprehensive overview' })
                        .setTimestamp();
                    break;
                }
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const { embed } = handleError(error, 'dev command', interaction);
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

