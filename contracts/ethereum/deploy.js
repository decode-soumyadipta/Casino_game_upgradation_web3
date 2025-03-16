// Deployment script for Casino Game smart contracts
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Casino Game contracts...");

  // Get the contract factories
  const CasinoGame = await ethers.getContractFactory("CasinoGame");
  const RandomnessProvider = await ethers.getContractFactory("RandomnessProvider");
  const RouletteGame = await ethers.getContractFactory("RouletteGame");

  // Deploy CasinoGame contract
  // Parameters: houseEdge (2.5%), minBet (0.01 ETH), maxBet (1 ETH)
  const houseEdge = 250; // 2.5% in basis points
  const minBet = ethers.utils.parseEther("0.01");
  const maxBet = ethers.utils.parseEther("1");
  
  console.log("Deploying CasinoGame...");
  const casinoGame = await CasinoGame.deploy(houseEdge, minBet, maxBet);
  await casinoGame.deployed();
  console.log("CasinoGame deployed to:", casinoGame.address);

  // Deploy RandomnessProvider contract
  // Note: These are example values for Ethereum mainnet
  // You'll need to adjust these based on the network you're deploying to
  const vrfCoordinator = "0x271682DEB8C4E0901D1a1550aD2e64D568E69909"; // Ethereum mainnet VRF Coordinator
  const subscriptionId = 1234; // Replace with your Chainlink VRF subscription ID
  const keyHash = "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef"; // Ethereum mainnet gas lane key hash
  const callbackGasLimit = 200000;
  
  console.log("Deploying RandomnessProvider...");
  const randomnessProvider = await RandomnessProvider.deploy(
    vrfCoordinator,
    subscriptionId,
    keyHash,
    callbackGasLimit
  );
  await randomnessProvider.deployed();
  console.log("RandomnessProvider deployed to:", randomnessProvider.address);

  // Deploy RouletteGame contract
  console.log("Deploying RouletteGame...");
  const rouletteGame = await RouletteGame.deploy(casinoGame.address, randomnessProvider.address);
  await rouletteGame.deployed();
  console.log("RouletteGame deployed to:", rouletteGame.address);

  // Set up permissions
  console.log("Setting up permissions...");
  
  // Add RouletteGame as an operator in CasinoGame
  const addOperatorTx = await casinoGame.addOperator(rouletteGame.address);
  await addOperatorTx.wait();
  console.log("Added RouletteGame as operator in CasinoGame");
  
  // Transfer ownership of RandomnessProvider to RouletteGame
  const transferOwnershipTx = await randomnessProvider.transferOwnership(rouletteGame.address);
  await transferOwnershipTx.wait();
  console.log("Transferred ownership of RandomnessProvider to RouletteGame");

  console.log("Deployment complete!");
  console.log("CasinoGame:", casinoGame.address);
  console.log("RandomnessProvider:", randomnessProvider.address);
  console.log("RouletteGame:", rouletteGame.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 