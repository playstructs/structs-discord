# structs-discord

A Discord bot application for the Structs game ecosystem. This bot provides Discord slash commands for players to interact with the Structs game, manage structures, fleets, resources, and more.

## Features

- **Player Commands**: Join guilds, explore planets, manage inventory, transfer resources
- **Structure Management**: Define, build, activate, and manage game structures
- **Fleet Operations**: Deploy and manage fleets, conduct raids
- **Energy Market**: Create offers, buy resources, redeem tokens
- **Energy Administration**: Manage allocations, substations, and infusions
- **GRASS Notifications**: Subscribe to game event notifications via NATS
- **Real-time Updates**: Receive game events through NATS message subscriptions
- **Developer Resources**: Quick access to [Structs Compendium](https://github.com/playstructs/structs-compendium) and API documentation via `/dev` command

## Prerequisites

- Node.js 16.x or higher
- PostgreSQL database with Structs schema
- Discord Bot Token and Client ID
- (Optional) NATS server for real-time notifications

## Installation

1. Clone the repository:
```bash
git clone https://github.com/playstructs/structs-discord.git
cd structs-discord
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# NATS Configuration (Optional)
# Defaults to nats://structs-nats:4222 if not set
NATS_URL=nats://structs-nats:4222
```

### Getting Discord Credentials

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Go to the "Bot" section to get your bot token
4. Go to the "General Information" section to get your Client ID

## Running the Bot

### Development Mode

```bash
npm run dev
```

This uses `nodemon` to automatically restart the bot when files change.

### Production Mode

```bash
npm start
```

### Deploying Commands

Before running the bot, you need to deploy the slash commands to Discord:

```bash
npm run deploy
```

This registers all slash commands with Discord. You only need to run this when:
- Adding new commands
- Modifying command structure
- After Discord cache clears

## Project Structure

```
structs-discord/
├── src/
│   ├── commands/          # Discord slash commands
│   │   ├── struct.js       # Structure management commands
│   │   ├── fleet.js        # Fleet operations
│   │   ├── allocation.js   # Energy allocations
│   │   └── ...             # Other commands
│   ├── services/           # External service integrations
│   │   └── nats.js         # NATS message service
│   ├── utils/              # Utility functions
│   ├── embeds/             # Discord embed builders
│   └── queries/            # Database query helpers
├── index.js                # Bot entry point
├── deploy-commands.js       # Command deployment script
└── package.json
```

## Database Transaction API

The bot uses PostgreSQL functions in the `signer` schema for game transactions. See [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) for complete documentation.

**Quick Reference:**
- Structure Management: `tx_struct_build_initiate`, `tx_struct_build_complete`, `tx_struct_activate`, etc.
- Fleet & Planet: `tx_fleet_move`, `tx_explore`, `tx_planet_raid_complete`
- Resources: `tx_infuse`, `tx_bank_send`, `tx_guild_bank_redeem`
- Allocations: `tx_allocation_create`, `tx_allocation_connect`, `tx_allocation_disconnect`, `tx_allocation_transfer`
- Substations: `tx_substation_create`, `tx_substation_player_connect`, `tx_substation_player_disconnect`
- Market: `tx_provider_create`, `tx_agreement_create`
- Player: `tx_player_resume`

For detailed parameter documentation and function signatures, see [docs/TRANSACTION_AUDIT.md](./docs/TRANSACTION_AUDIT.md).

## Development

### Running Tests

```bash
npm test
```

**Note**: If Jest is not installed, add it to `devDependencies`:
```bash
npm install --save-dev jest
```

See [Testing Guide](docs/TESTING_GUIDE.md) for comprehensive testing documentation.

### Code Structure

Commands follow a consistent pattern:
- `data`: SlashCommandBuilder definition
- `autocomplete`: (Optional) Autocomplete handler for dynamic options
- `execute`: Command execution handler

### Adding New Commands

1. Create a new file in `src/commands/`
2. Export an object with `data` and `execute` properties
3. The command will be automatically loaded by `src/commands/index.js`
4. Run `npm run deploy` to register the command with Discord

## Troubleshooting

### Bot doesn't respond to commands
- Ensure commands are deployed: `npm run deploy`
- Check that the bot has proper permissions in your Discord server
- Verify `DISCORD_TOKEN` is set correctly

### Database connection errors
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running and accessible
- Check database schema is installed
- See [Structs Compendium](https://github.com/playstructs/structs-compendium) for database schema documentation

### NATS connection errors
- NATS is optional - the bot will continue without it
- If using NATS, verify `NATS_URL` is correct
- Check NATS server is running and accessible

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- Commands include proper error handling
- Database queries use parameterized statements
- New features include appropriate Discord embeds

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

### API & Development Documentation
- [Documentation Index](docs/README.md) - Start here for an overview of all documentation
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Guide for adding new commands and contributing
- [Quick Reference](docs/QUICK_REFERENCE.md) - Quick code snippets and common patterns
- [API Reference](docs/API_REFERENCE.md) - Complete database transaction API documentation (28 functions)
- [Code Examples](docs/CODE_EXAMPLES.md) - Practical code examples and workflows
- [Database Queries](docs/DATABASE_QUERIES.md) - Query patterns, autocomplete, and schema interactions
- [Utilities API](docs/UTILITIES_API.md) - Error handling, formatting, and helper functions
- [Testing Guide](docs/TESTING_GUIDE.md) - Testing patterns and examples
- [Quick Reference](docs/QUICK_REFERENCE.md) - Cheat sheet for common patterns and snippets
- [Transaction Audit](docs/TRANSACTION_AUDIT.md) - Verified function signatures and parameter types
- [Best Practices](docs/BEST_PRACTICES.md) - Development guidelines and best practices

### Game Documentation
> **Note**: This bot project focuses on **bot implementation documentation**. For comprehensive game mechanics, API documentation, schemas, and protocols, see the **[Structs Compendium](https://github.com/playstructs/structs-compendium)**.

- [Game Documentation](docs/GAME_DOCUMENTATION.md) - Links to compendium and game documentation
- [Structs Compendium](https://github.com/playstructs/structs-compendium) - Complete game documentation repository
- [Agent Guide](https://github.com/playstructs/structs-compendium/blob/main/AGENTS.md) - Start here for AI agents
- [Loading Strategy](https://github.com/playstructs/structs-compendium/blob/main/LOADING_STRATEGY.md) - Efficient documentation loading

**Access from Discord**: Use `/dev compendium` command for quick links

> **Quick Start**: New developers should start with the [Documentation Index](docs/README.md) for a guided overview.

## License

Apache-2.0

## Support

- Issues: [GitHub Issues](https://github.com/playstructs/structs-discord/issues)
- Repository: [GitHub Repository](https://github.com/playstructs/structs-discord)
