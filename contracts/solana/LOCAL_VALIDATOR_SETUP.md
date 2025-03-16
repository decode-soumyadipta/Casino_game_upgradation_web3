# Setting Up a Local Solana Validator for Testing

This guide will help you set up a local Solana validator for testing your casino game program.

## Prerequisites

1. Install the Solana CLI tools:
   - For Windows: Download and install from [Solana Releases](https://github.com/solana-labs/solana/releases)
   - For macOS: `brew install solana`
   - For Linux: `sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"`

2. Ensure Rust and Cargo are installed:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

3. Install the Solana BPF toolchain:
   ```bash
   rustup component add rust-src
   solana-install install v1.17.0
   ```

## Starting a Local Validator

1. Start a local Solana validator:
   ```bash
   solana-test-validator
   ```

   This will start a local validator with default settings. Keep this terminal window open.

2. In a new terminal, configure your Solana CLI to use the local network:
   ```bash
   solana config set --url localhost
   ```

3. Create a new keypair for testing:
   ```bash
   solana-keygen new -o test-keypair.json
   ```

4. Airdrop some SOL to your test account:
   ```bash
   solana airdrop 10 $(solana-keygen pubkey test-keypair.json)
   ```

## Building and Deploying Your Program

1. Navigate to your Solana program directory:
   ```bash
   cd contracts/solana
   ```

2. Build your program:
   ```bash
   cargo build-bpf
   ```

3. Deploy your program to the local validator:
   ```bash
   solana program deploy target/deploy/casino_game.so
   ```

   Note the program ID that is output after deployment.

4. Update your program ID in the code:
   - Open `src/lib.rs`
   - Update the program ID in the `id` module to match the deployed program ID

## Running Integration Tests Against the Local Validator

1. Create a test script that uses the Solana web3.js library to interact with your program:
   ```javascript
   // test-casino.js
   const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
   const fs = require('fs');

   async function main() {
     // Connect to the local Solana cluster
     const connection = new Connection('http://localhost:8899', 'confirmed');
     
     // Load your keypair
     const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync('test-keypair.json')));
     const keypair = Keypair.fromSecretKey(secretKey);
     
     // Your program ID
     const programId = new PublicKey('YOUR_DEPLOYED_PROGRAM_ID');
     
     // Create and send transactions to interact with your program
     // ...
   }

   main().then(
     () => process.exit(),
     err => {
       console.error(err);
       process.exit(-1);
     }
   );
   ```

2. Run your test script:
   ```bash
   node test-casino.js
   ```

## Monitoring Your Program

1. View program logs:
   ```bash
   solana logs
   ```

2. View account data:
   ```bash
   solana account <ACCOUNT_ADDRESS>
   ```

## Troubleshooting

1. If you encounter issues with the local validator, try resetting it:
   ```bash
   solana-test-validator --reset
   ```

2. If your program deployment fails, check the build output for errors:
   ```bash
   cargo build-bpf --verbose
   ```

3. Ensure your program ID in the code matches the deployed program ID.

## Additional Resources

- [Solana Documentation](https://docs.solana.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Program Library](https://spl.solana.com/)
- [Anchor Framework](https://project-serum.github.io/anchor/) (for more complex Solana programs) 