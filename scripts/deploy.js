const { ethers } = require("hardhat");

// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts to", network.name);

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy RandomnessProvider first
  const RandomnessProvider = await ethers.getContractFactory("RandomnessProvider");
  const randomnessProvider = await RandomnessProvider.deploy();
  await randomnessProvider.waitForDeployment();
  const randomnessProviderAddress = await randomnessProvider.getAddress();
  console.log("RandomnessProvider deployed to:", randomnessProviderAddress);

  // Deploy CasinoGame with the RandomnessProvider address
  const CasinoGame = await ethers.getContractFactory("CasinoGame");
  const casinoGame = await CasinoGame.deploy(randomnessProviderAddress);
  await casinoGame.waitForDeployment();
  const casinoGameAddress = await casinoGame.getAddress();
  console.log("CasinoGame deployed to:", casinoGameAddress);

  // Set initial parameters for CasinoGame
  const houseEdgeBasisPoints = 250; // 2.5%
  const minBet = ethers.parseEther("0.01");
  const maxBet = ethers.parseEther("1");

  console.log("Setting house edge to", houseEdgeBasisPoints, "basis points");
  await casinoGame.setHouseEdge(houseEdgeBasisPoints);
  
  console.log("Setting bet limits to", ethers.formatEther(minBet), "ETH -", ethers.formatEther(maxBet), "ETH");
  await casinoGame.setBetLimits(minBet, maxBet);

  console.log("Deployment complete!");
  
  // Return the contract addresses for verification
  return {
    RandomnessProvider: randomnessProviderAddress,
    CasinoGame: casinoGameAddress
  };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

module.exports = { main }; 