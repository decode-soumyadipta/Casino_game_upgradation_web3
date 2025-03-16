require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-gas-reporter");
require("solidity-coverage");

// Try to load .env file, but don't fail if it doesn't exist
try {
  require("dotenv").config();
} catch (e) {
  console.log("No .env file found or error loading it. Using default config.");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "london"
    }
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337
    }
  },
  gasReporter: {
    enabled: (process.env.REPORT_GAS === "true"),
    outputFile: "gas-report.txt",
    noColors: true,
    currency: "USD"
  },
  mocha: {
    timeout: 60000
  }
}; 