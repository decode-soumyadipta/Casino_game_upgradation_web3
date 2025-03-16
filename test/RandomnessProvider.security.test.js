import { expect } from 'chai';
import pkg from 'hardhat';
const { ethers } = pkg;
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe("RandomnessProvider Security Tests", function () {
  // Deploy the RandomnessProvider contract
  async function deployRandomnessProviderFixture() {
    const [owner, casinoGame, attacker] = await ethers.getSigners();

    // Deploy RandomnessProvider
    const RandomnessProvider = await ethers.getContractFactory("RandomnessProvider");
    const randomnessProvider = await RandomnessProvider.deploy();
    await randomnessProvider.deployed();

    // Set the casino game address
    await randomnessProvider.setCasinoGameAddress(casinoGame.address);

    return { randomnessProvider, owner, casinoGame, attacker };
  }

  describe("Access Control", function () {
    it("Should prevent non-owners from setting the casino game address", async function () {
      const { randomnessProvider, attacker } = await loadFixture(deployRandomnessProviderFixture);
      
      // Attacker tries to set themselves as the casino game
      await expect(
        randomnessProvider.connect(attacker).setCasinoGameAddress(attacker.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("Should prevent non-casino games from requesting randomness", async function () {
      const { randomnessProvider, attacker } = await loadFixture(deployRandomnessProviderFixture);
      
      // Attacker tries to request randomness
      await expect(
        randomnessProvider.connect(attacker).requestRandomness(1)
      ).to.be.revertedWith("Only authorized casino game can request randomness");
    });
  });

  describe("Randomness Quality", function () {
    it("Should generate different random numbers for different requests", async function () {
      const { randomnessProvider, casinoGame } = await loadFixture(deployRandomnessProviderFixture);
      
      // Request randomness multiple times
      await randomnessProvider.connect(casinoGame).requestRandomness(1);
      await randomnessProvider.connect(casinoGame).requestRandomness(2);
      await randomnessProvider.connect(casinoGame).requestRandomness(3);
      
      // Get the random numbers
      const random1 = await randomnessProvider.getRandomNumber(1);
      const random2 = await randomnessProvider.getRandomNumber(2);
      const random3 = await randomnessProvider.getRandomNumber(3);
      
      // Verify they are different
      expect(random1).to.not.equal(random2);
      expect(random1).to.not.equal(random3);
      expect(random2).to.not.equal(random3);
    });
    
    it("Should use secure randomness sources", async function () {
      const { randomnessProvider, casinoGame } = await loadFixture(deployRandomnessProviderFixture);
      
      // Request randomness
      await randomnessProvider.connect(casinoGame).requestRandomness(1);
      
      // Get the random number
      const randomNumber = await randomnessProvider.getRandomNumber(1);
      
      // Verify it's not zero (basic check)
      expect(randomNumber).to.not.equal(0);
      
      // Note: In a real test, we would check for statistical properties
      // of the random numbers, but that's beyond the scope of this test
    });
  });

  describe("State Management", function () {
    it("Should correctly track game IDs and their random numbers", async function () {
      const { randomnessProvider, casinoGame } = await loadFixture(deployRandomnessProviderFixture);
      
      // Request randomness for multiple games
      await randomnessProvider.connect(casinoGame).requestRandomness(1);
      await randomnessProvider.connect(casinoGame).requestRandomness(2);
      
      // Get the random numbers
      const random1 = await randomnessProvider.getRandomNumber(1);
      const random2 = await randomnessProvider.getRandomNumber(2);
      
      // Request again for the same game ID
      await randomnessProvider.connect(casinoGame).requestRandomness(1);
      
      // Get the new random number
      const random1New = await randomnessProvider.getRandomNumber(1);
      
      // Verify it's different from the original
      expect(random1).to.not.equal(random1New);
    });
    
    it("Should revert when trying to get a random number for a non-existent game", async function () {
      const { randomnessProvider } = await loadFixture(deployRandomnessProviderFixture);
      
      // Try to get a random number for a game that doesn't exist
      await expect(
        randomnessProvider.getRandomNumber(999)
      ).to.be.revertedWith("No random number generated for this game ID");
    });
  });

  describe("Upgrade Safety", function () {
    it("Should allow owner to update the randomness generation method", async function () {
      const { randomnessProvider, owner, casinoGame } = await loadFixture(deployRandomnessProviderFixture);
      
      // Deploy the upgraded RandomnessProvider
      const UpgradedRandomnessProvider = await ethers.getContractFactory("UpgradedRandomnessProvider");
      const upgradedRandomnessProvider = await UpgradedRandomnessProvider.deploy();
      await upgradedRandomnessProvider.deployed();
      
      // Set the casino game address in the new provider
      await upgradedRandomnessProvider.setCasinoGameAddress(casinoGame.address);
      
      // Request randomness from both providers
      await randomnessProvider.connect(casinoGame).requestRandomness(1);
      await upgradedRandomnessProvider.connect(casinoGame).requestRandomness(1);
      
      // Get the random numbers
      const random1 = await randomnessProvider.getRandomNumber(1);
      const random1Upgraded = await upgradedRandomnessProvider.getRandomNumber(1);
      
      // They should be different due to different generation methods
      expect(random1).to.not.equal(random1Upgraded);
    });
  });

  describe("Gas Optimization", function () {
    it("Should use gas-efficient randomness generation", async function () {
      const { randomnessProvider, casinoGame } = await loadFixture(deployRandomnessProviderFixture);
      
      // Measure gas used for randomness request
      const tx = await randomnessProvider.connect(casinoGame).requestRandomness(1);
      const receipt = await tx.wait();
      
      // Check gas used is reasonable (below 100,000)
      expect(receipt.gasUsed).to.be.below(100000);
    });
  });

  describe("Integration with CasinoGame", function () {
    it("Should correctly integrate with the CasinoGame contract", async function () {
      const [owner, player] = await ethers.getSigners();
      
      // Deploy RandomnessProvider
      const RandomnessProvider = await ethers.getContractFactory("RandomnessProvider");
      const randomnessProvider = await RandomnessProvider.deploy();
      await randomnessProvider.deployed();
      
      // Deploy CasinoGame with the RandomnessProvider
      const CasinoGame = await ethers.getContractFactory("CasinoGame");
      const casinoGame = await CasinoGame.deploy(randomnessProvider.address);
      await casinoGame.deployed();
      
      // Set the casino game address in the RandomnessProvider
      await randomnessProvider.setCasinoGameAddress(casinoGame.address);
      
      // Set house edge and bet limits
      const houseEdgeBasisPoints = 250; // 2.5%
      const minBet = ethers.utils.parseEther("0.01");
      const maxBet = ethers.utils.parseEther("1");
      
      await casinoGame.setHouseEdge(houseEdgeBasisPoints);
      await casinoGame.setBetLimits(minBet, maxBet);
      
      // Player places a bet
      const betAmount = ethers.utils.parseEther("0.1");
      await casinoGame.connect(player).placeBet({ value: betAmount });
      
      // Verify the game was created
      const gameCount = await casinoGame.gameCount();
      expect(gameCount).to.equal(1);
      
      // Verify randomness was requested
      const hasRandomNumber = await randomnessProvider.hasRandomNumber(1);
      expect(hasRandomNumber).to.be.true;
    });
  });
}); 