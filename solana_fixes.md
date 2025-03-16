# Suggested Fixes for Solana Contracts

## 1. Add Tokio as a Dev-Dependency

The integration tests in the Solana contracts use the `tokio` runtime for async testing, but the dependency is missing from the Cargo.toml file. To fix this, add tokio to the dev-dependencies section:

```toml
[dev-dependencies]
solana-program-test = "1.16.0"
solana-sdk = "1.16.0"
tokio = { version = "1.28.0", features = ["full"] }
```

## 2. Update Solana Program Dependency

The warnings about unexpected `cfg` condition values suggest that the `solana_program` dependency might be outdated. Update it to a newer version:

```toml
[dependencies]
solana-program = "1.17.0"  # Update to a newer version
thiserror = "1.0.40"
borsh = "0.10.3"
borsh-derive = "0.10.3"
spl-token = { version = "3.5.0", features = ["no-entrypoint"] }
spl-associated-token-account = { version = "1.1.3", features = ["no-entrypoint"] }
arrayref = "0.3.7"
```

## 3. Complete the Client.rs File

The `client.rs` file appears to be empty or incomplete. This file should contain client-side functions for interacting with the Solana program. Here's a suggested implementation:

```rust
use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_program,
};

use crate::instruction::CasinoInstruction;

/// Initialize a new casino
pub fn initialize(
    authority: &Pubkey,
    casino_state: &Pubkey,
    house_edge: u16,
    min_bet: u64,
    max_bet: u64,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new(*authority, true),
        AccountMeta::new(*casino_state, false),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    Instruction::new_with_borsh(
        crate::id::id(),
        &CasinoInstruction::Initialize {
            house_edge,
            min_bet,
            max_bet,
        },
        accounts,
    )
}

/// Place a bet
pub fn place_bet(
    player: &Pubkey,
    casino_state: &Pubkey,
    game: &Pubkey,
    game_id: [u8; 32],
    bet_amount: u64,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new(*player, true),
        AccountMeta::new_readonly(*casino_state, false),
        AccountMeta::new(*game, false),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    Instruction::new_with_borsh(
        crate::id::id(),
        &CasinoInstruction::PlaceBet {
            game_id,
            bet_amount,
        },
        accounts,
    )
}

/// Settle a game
pub fn settle_game(
    operator: &Pubkey,
    casino_state: &Pubkey,
    game: &Pubkey,
    player: &Pubkey,
    player_won: bool,
    win_amount: u64,
    result_hash: [u8; 32],
) -> Instruction {
    let accounts = vec![
        AccountMeta::new(*operator, true),
        AccountMeta::new_readonly(*casino_state, false),
        AccountMeta::new(*game, false),
        AccountMeta::new(*player, false),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    Instruction::new_with_borsh(
        crate::id::id(),
        &CasinoInstruction::SettleGame {
            player_won,
            win_amount,
            result_hash,
        },
        accounts,
    )
}

/// Update casino parameters
pub fn update_params(
    authority: &Pubkey,
    casino_state: &Pubkey,
    house_edge: Option<u16>,
    min_bet: Option<u64>,
    max_bet: Option<u64>,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new(*authority, true),
        AccountMeta::new(*casino_state, false),
    ];

    Instruction::new_with_borsh(
        crate::id::id(),
        &CasinoInstruction::UpdateParams {
            house_edge,
            min_bet,
            max_bet,
        },
        accounts,
    )
}

/// Add an operator
pub fn add_operator(
    authority: &Pubkey,
    casino_state: &Pubkey,
    operator: &Pubkey,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new(*authority, true),
        AccountMeta::new(*casino_state, false),
    ];

    Instruction::new_with_borsh(
        crate::id::id(),
        &CasinoInstruction::AddOperator {
            operator: *operator,
        },
        accounts,
    )
}

/// Remove an operator
pub fn remove_operator(
    authority: &Pubkey,
    casino_state: &Pubkey,
    operator: &Pubkey,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new(*authority, true),
        AccountMeta::new(*casino_state, false),
    ];

    Instruction::new_with_borsh(
        crate::id::id(),
        &CasinoInstruction::RemoveOperator {
            operator: *operator,
        },
        accounts,
    )
}
```

## 4. Running the Tests

After making these changes, you should be able to run the integration tests:

```bash
cargo test
```

To run a specific test:

```bash
cargo test test::test_initialize_casino -- --nocapture
```

To run all tests with detailed output:

```bash
cargo test -- --nocapture
```

## 5. Setting Up a Local Validator

For more comprehensive testing, consider setting up a local Solana validator:

1. Install the Solana CLI tools
2. Start a local validator: `solana-test-validator`
3. Build and deploy your program: `cargo build-bpf && solana program deploy target/deploy/casino_game.so`
4. Run integration tests against the local validator

This will allow you to test your program in an environment that more closely resembles the actual Solana blockchain. 