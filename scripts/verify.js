import { run } from "hardhat";

async function main() {
  // Replace these with the actual deployed contract addresses
  const RANDOMNESS_PROVIDER_ADDRESS = process.env.RANDOMNESS_PROVIDER_ADDRESS;
  const CASINO_GAME_ADDRESS = process.env.CASINO_GAME_ADDRESS;

  if (!RANDOMNESS_PROVIDER_ADDRESS || !CASINO_GAME_ADDRESS) {
    console.error("Please set the contract addresses in the .env file");
    process.exit(1);
  }

  console.log("Starting contract verification on Etherscan...");

  // Verify RandomnessProvider
  console.log(`Verifying RandomnessProvider at ${RANDOMNESS_PROVIDER_ADDRESS}...`);
  try {
    await run("verify:verify", {
      address: RANDOMNESS_PROVIDER_ADDRESS,
      constructorArguments: [],
    });
    console.log("RandomnessProvider verified successfully!");
  } catch (error) {
    console.error("Error verifying RandomnessProvider:", error.message);
  }

  // Verify CasinoGame
  console.log(`Verifying CasinoGame at ${CASINO_GAME_ADDRESS}...`);
  try {
    await run("verify:verify", {
      address: CASINO_GAME_ADDRESS,
      constructorArguments: [RANDOMNESS_PROVIDER_ADDRESS],
    });
    console.log("CasinoGame verified successfully!");
  } catch (error) {
    console.error("Error verifying CasinoGame:", error.message);
  }

  console.log("Verification process completed!");
}

// Execute the verification
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  }); 