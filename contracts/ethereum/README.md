# Casino Game Ethereum Contracts

This directory contains the Ethereum smart contracts for the Casino Game platform, implemented with Hardhat for optimal development and testing.

## Contracts

- **CasinoGame.sol**: The main contract that handles betting, game settlement, and withdrawals.
- **RandomnessProvider.sol**: A contract that provides randomness for the casino games.

## Development Setup

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```
   SEPOLIA_URL=https://sepolia.infura.io/v3/your-api-key
   MAINNET_URL=https://mainnet.infura.io/v3/your-api-key
   PRIVATE_KEY=your-private-key-for-deployments
   ETHERSCAN_API_KEY=your-etherscan-api-key
   COINMARKETCAP_API_KEY=your-coinmarketcap-api-key
   REPORT_GAS=true
   ```

### Compilation

Compile the contracts:

```bash
npm run hardhat:compile
```

### Testing

Run the tests:

```bash
npm run hardhat:test
```

For gas reporting:

```bash
npm run hardhat:gas-report
```

For code coverage:

```bash
npm run hardhat:coverage
```

### Local Development

Start a local Hardhat node:

```bash
npm run hardhat:node
```

### Deployment

Deploy to the local Hardhat network:

```bash
npm run hardhat:deploy
```

Deploy to Sepolia testnet:

```bash
npm run hardhat:deploy:sepolia
```

## Project Structure

```
contracts/ethereum/
├── contracts/           # Smart contracts
│   ├── CasinoGame.sol
│   ├── RandomnessProvider.sol
│   └── mocks/           # Mock contracts for testing
├── scripts/             # Deployment scripts
│   └── deploy.js
├── test/                # Test files
│   ├── CasinoGame.hardhat.test.js
│   └── RandomnessProvider.hardhat.test.js
├── hardhat.config.js    # Hardhat configuration
└── .env                 # Environment variables (not committed)
```

## Security Considerations

- The contracts use OpenZeppelin's security libraries for reentrancy protection, access control, and pausability.
- Randomness generation in Ethereum is challenging - consider using Chainlink VRF for production.
- Always conduct a professional security audit before deploying to mainnet.

## Gas Optimization

The contracts have been optimized for gas efficiency:
- Using appropriate data types
- Minimizing storage operations
- Implementing efficient algorithms

Gas reports are generated during testing to monitor gas usage.

## License

MIT 