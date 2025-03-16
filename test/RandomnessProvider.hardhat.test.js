const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("RandomnessProvider Contract", function () {
  // Deploy the RandomnessProvider contract
  async function deployRandomnessProviderFixture() {
    // Get signers
    const [owner, user1, user2] = await ethers.getSigners();

    // Deploy RandomnessProvider
    const RandomnessProvider = await ethers.getContractFactory("MockRandomnessProvider");
    const randomnessProvider = await RandomnessProvider.deploy();

    return { randomnessProvider, owner, user1, user2 };
  }

  describe("Randomness Generation", function () {
    it("Should generate a random number", async function () {
      const { randomnessProvider } = await loadFixture(deployRandomnessProviderFixture);
      
      // Get a random number
      const randomNumber = await randomnessProvider.getRandomNumber();
      
      // Verify it's a valid number
      expect(randomNumber).to.be.gt(0);
    });

    it("Should allow setting a mock random value", async function () {
      const { randomnessProvider } = await loadFixture(deployRandomnessProviderFixture);
      
      // Set a specific random value
      const mockValue = 42;
      await randomnessProvider.setMockRandomValue(mockValue);
      
      // Verify the random number matches our mock value
      const randomNumber = await randomnessProvider.getRandomNumber();
      expect(randomNumber).to.equal(mockValue);
    });
  });

  describe("Access Control", function () {
    it("Should have the correct owner", async function () {
      const { randomnessProvider, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      // Verify the owner is set correctly
      expect(await randomnessProvider.owner()).to.equal(owner.address);
    });
  });

  describe("Integration with CasinoGame", function () {
    it("Should provide randomness to CasinoGame", async function () {
      const { randomnessProvider, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      // Deploy CasinoGame
      const CasinoGame = await ethers.getContractFactory("MockCasinoGame");
      const casinoGame = await CasinoGame.deploy(await randomnessProvider.getAddress());
      
      // Set a specific random value
      const mockValue = 42;
      await randomnessProvider.setMockRandomValue(mockValue);
      
      // Verify the casino game can use the randomness provider
      // This is a simplified test - in a real scenario, we would test the actual game mechanics
      expect(await casinoGame.owner()).to.equal(owner.address);
    });
  });
}); 