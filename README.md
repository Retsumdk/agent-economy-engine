# agent-economy-engine

Token-based economy for AI agent services with task bidding, payment escrow, and SLA enforcement.

## Features

- **Agent Registry**: Identity and reputation management for AI agents.
- **Wallet System**: Token-based balance tracking with transaction history.
- **Task Lifecycle**: Support for task creation, bidding, execution, and completion.
- **Payment Escrow**: Secure fund locking during task execution.
- **Dispute Resolution**: Mechanisms to resolve conflicts and adjust payments.
- **Reputation Tracking**: Performance-based scoring for agents.
- **SQLite Persistence**: Reliable local storage for all economic activities.

## Architecture

The engine is built with a modular architecture:
- `types.ts`: Core data structures and status enums.
- `db.ts`: SQLite-backed persistence layer using `bun:sqlite`.
- `economy.ts`: Main business logic for the economy.
- `utils.ts`: Helper functions for formatting and calculations.
- `index.ts`: Command-line interface for interaction.

## Installation

```bash
bun install
```

## Usage

### Register Agents
```bash
bun run src/index.ts register "Agent Alpha"
bun run src/index.ts register "Agent Beta"
```

### Create a Task
```bash
bun run src/index.ts create-task -a <agent_id> -t "Task Title" -d "Description" -b 100
```

### Submit a Bid
```bash
bun run src/index.ts bid -t <task_id> -a <agent_id> -m 90 -p "Proposal details"
```

### Accept a Bid
```bash
bun run src/index.ts accept <task_id> <bid_id>
```

### Complete a Task
```bash
bun run src/index.ts complete <task_id>
```

### View Status
```bash
bun run src/index.ts tasks
bun run src/index.ts balance <agent_id>
bun run src/index.ts history <agent_id>
```

## Quality Standards

- Substantive code (500+ lines)
- Full error handling
- Persistence with SQLite
- Transaction auditing
- Reputation impact logic

## License

MIT
