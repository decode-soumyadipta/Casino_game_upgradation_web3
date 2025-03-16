import { ethers } from "hardhat";

// Contract addresses - replace with your deployed contract addresses
const CASINO_GAME_ADDRESS = process.env.CASINO_GAME_ADDRESS;
const RANDOMNESS_PROVIDER_ADDRESS = process.env.RANDOMNESS_PROVIDER_ADDRESS;

async function main() {
  if (!CASINO_GAME_ADDRESS || !RANDOMNESS_PROVIDER_ADDRESS) {
    console.error("Please set the contract addresses in the .env file");
    process.exit(1);
  }

  // Get the signer
  const [owner] = await ethers.getSigners();
  console.log(`Interacting with contracts using account: ${owner.address}`);
  
  // Get contract instances
  const casinoGame = await ethers.getContractAt("CasinoGame", CASINO_GAME_ADDRESS);
  const randomnessProvider = await ethers.getContractAt("RandomnessProvider", RANDOMNESS_PROVIDER_ADDRESS);
  
  // Display current contract state
  console.log("\n--- Current Contract State ---");
  
  const houseEdge = await casinoGame.houseEdge();
  const minBet = await casinoGame.minBet();
  const maxBet = await casinoGame.maxBet();
  const isPaused = await casinoGame.paused();
  const contractBalance = await ethers.provider.getBalance(CASINO_GAME_ADDRESS);
  
  console.log(`House Edge: ${houseEdge} basis points (${houseEdge / 100}%)`);
  console.log(`Bet Limits: Min ${ethers.formatEther(minBet)} ETH, Max ${ethers.formatEther(maxBet)} ETH`);
  console.log(`Contract Paused: ${isPaused}`);
  console.log(`Contract Balance: ${ethers.formatEther(contractBalance)} ETH`);
  
  // Menu of actions
  console.log("\n--- Available Actions ---");
  console.log("1. Update house edge");
  console.log("2. Update bet limits");
  console.log("3. Pause/unpause contract");
  console.log("4. Emergency withdraw funds");
  console.log("5. Get random number");
  console.log("6. Exit");
  
  // Read user input (in a real script, you would use a library like inquirer)
  const action = process.argv[2] || "6";
  
  switch (action) {
    case "1":
      // Update house edge
      const newHouseEdge = 300; // 3%
      console.log(`Setting house edge to ${newHouseEdge} basis points (${newHouseEdge / 100}%)...`);
      const txHouseEdge = await casinoGame.setHouseEdge(newHouseEdge);
      await txHouseEdge.wait();
      console.log("House edge updated successfully!");
      break;
      
    case "2":
      // Update bet limits
      const newMinBet = ethers.parseEther("0.05");
      const newMaxBet = ethers.parseEther("2");
      console.log(`Setting bet limits: Min ${ethers.formatEther(newMinBet)} ETH, Max ${ethers.formatEther(newMaxBet)} ETH...`);
      const txBetLimits = await casinoGame.setBetLimits(newMinBet, newMaxBet);
      await txBetLimits.wait();
      console.log("Bet limits updated successfully!");
      break;
      
    case "3":
      // Pause/unpause contract
      if (isPaused) {
        console.log("Unpausing contract...");
        const txUnpause = await casinoGame.unpause();
        await txUnpause.wait();
        console.log("Contract unpaused successfully!");
      } else {
        console.log("Pausing contract...");
        const txPause = await casinoGame.pause();
        await txPause.wait();
        console.log("Contract paused successfully!");
      }
      break;
      
    case "4":
      // Emergency withdraw funds
      if (contractBalance.isZero()) {
        console.log("Contract has no balance to withdraw.");
        break;
      }
      
      console.log(`Withdrawing ${ethers.formatEther(contractBalance)} ETH...`);
      const txWithdraw = await casinoGame.emergencyWithdraw(contractBalance);
      await txWithdraw.wait();
      console.log("Funds withdrawn successfully!");
      break;
      
    case "5":
      // Get random number
      console.log("Getting random number...");
      const randomNumber = await randomnessProvider.getRandomNumber();
      console.log(`Random number: ${randomNumber.toString()}`);
      break;
      
    case "6":
    default:
      console.log("Exiting...");
      break;
  }
}

// Execute the interaction script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Interaction failed:", error);
    process.exit(1);
  }); 