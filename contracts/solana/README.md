# Casino Game Solana Program

This is the Solana implementation of the Casino Game platform.

## Overview

The Casino Game Solana program provides a decentralized platform for casino games on the Solana blockchain. It includes functionality for:

- Casino initialization and management
- Placing bets
- Settling games
- Managing operators

## Project Structure

- `src/lib.rs`: Main entry point for the Solana program
- `src/client.rs`: Client-side functions for interacting with the program
- `src/test.rs`: Integration tests
- `src/security_test.rs`: Security-focused tests
- `src/edge_cases_test.rs`: Edge case tests

## Prerequisites

- Rust and Cargo
- Solana CLI tools
- Node.js and npm (for web3 integration)

## Setup

1. Install Rust and Cargo:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Install Solana CLI tools:
   - For Windows: Download and install from [Solana Releases](https://github.com/solana-labs/solana/releases)
   - For macOS: `brew install solana`
   - For Linux: `sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"`

## Running Tests

### Using the Test Scripts

We provide scripts to run all tests:

- For Windows (PowerShell):
  ```powershell
  .\run_tests.ps1
  ```

- For Unix-based systems (Bash):
  ```bash
  chmod +x run_tests.sh
  ./run_tests.sh
  ```

### Running Tests Manually

1. Run all tests:
   ```bash
   cargo test
   ```

2. Run a specific test with output:
   ```bash
   cargo test test::test_initialize_casino -- --nocapture
   ```

3. Run tests with a specific feature:
   ```bash
   cargo test --features test-bpf
   ```

## Local Validator Testing

For testing with a local Solana validator, see [LOCAL_VALIDATOR_SETUP.md](./LOCAL_VALIDATOR_SETUP.md).

## Building for Deployment

1. Build the program:
   ```bash
   cargo build-bpf
   ```

2. Deploy to a Solana cluster:
   ```bash
   solana program deploy target/deploy/casino_game.so
   ```

## License

ISC 