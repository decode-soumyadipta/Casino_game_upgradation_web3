const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("RandomnessProvider Contract Security Tests", function () {
  // We need to deploy a mock VRF Coordinator for testing
  async function deployMockVRFCoordinator() {
    const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinator");
    const mockVRFCoordinator = await MockVRFCoordinator.deploy();
    return mockVRFCoordinator;
  }

  // We define a fixture to reuse the same setup in every test
  async function deployRandomnessProviderFixture() {
    // Get signers
    const [owner, user1, user2, attacker] = await ethers.getSigners();

    // Deploy mock VRF Coordinator
    const mockVRFCoordinator = await deployMockVRFCoordinator();

    // Deploy RandomnessProvider contract
    const subscriptionId = 1234;
    const keyHash = "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef";
    const callbackGasLimit = 200000;
    
    const RandomnessProvider = await ethers.getContractFactory("RandomnessProvider");
    const randomnessProvider = await RandomnessProvider.deploy(
      mockVRFCoordinator.address,
      subscriptionId,
      keyHash,
      callbackGasLimit
    );
    
    return { 
      randomnessProvider, 
      mockVRFCoordinator, 
      owner, 
      user1, 
      user2, 
      attacker, 
      subscriptionId, 
      keyHash, 
      callbackGasLimit 
    };
  }

  describe("Access Control", function () {
    it("Should prevent non-owners from requesting randomness", async function () {
      const { randomnessProvider, attacker } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      await expect(
        randomnessProvider.connect(attacker).requestRandomness(gameId)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should prevent non-VRF coordinators from fulfilling randomness", async function () {
      const { randomnessProvider, owner, attacker } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      const requestId = 123;
      const randomWords = [ethers.BigNumber.from("12345")];
      
      // First request randomness properly
      await randomnessProvider.connect(owner).requestRandomness(gameId);
      
      // Try to call the fulfillment function directly (which should fail)
      await expect(
        randomnessProvider.connect(attacker).rawFulfillRandomWords(requestId, randomWords)
      ).to.be.reverted;
    });
  });

  describe("State Management", function () {
    it("Should prevent requesting randomness twice for the same game", async function () {
      const { randomnessProvider, mockVRFCoordinator, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      // Mock the VRF Coordinator to return a specific requestId
      const requestId = 123;
      await mockVRFCoordinator.setRequestId(requestId);
      
      // Request randomness first time
      await randomnessProvider.connect(owner).requestRandomness(gameId);
      
      // Try to request randomness again for the same game
      await expect(
        randomnessProvider.connect(owner).requestRandomness(gameId)
      ).to.be.revertedWith("Randomness already requested for this game");
    });

    it("Should handle multiple game requests correctly", async function () {
      const { randomnessProvider, mockVRFCoordinator, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      // Create multiple game IDs
      const gameId1 = ethers.utils.id("game1");
      const gameId2 = ethers.utils.id("game2");
      const gameId3 = ethers.utils.id("game3");
      
      // Mock the VRF Coordinator to return specific requestIds
      await mockVRFCoordinator.setRequestId(123);
      await randomnessProvider.connect(owner).requestRandomness(gameId1);
      
      await mockVRFCoordinator.setRequestId(456);
      await randomnessProvider.connect(owner).requestRandomness(gameId2);
      
      await mockVRFCoordinator.setRequestId(789);
      await randomnessProvider.connect(owner).requestRandomness(gameId3);
      
      // Fulfill the randomness requests
      const randomWords1 = [ethers.BigNumber.from("11111")];
      const randomWords2 = [ethers.BigNumber.from("22222")];
      const randomWords3 = [ethers.BigNumber.from("33333")];
      
      await mockVRFCoordinator.fulfillRandomWords(123, randomnessProvider.address, randomWords1);
      await mockVRFCoordinator.fulfillRandomWords(456, randomnessProvider.address, randomWords2);
      await mockVRFCoordinator.fulfillRandomWords(789, randomnessProvider.address, randomWords3);
      
      // Check that each game has the correct random number
      const [result1, fulfilled1] = await randomnessProvider.getRandomResult(gameId1);
      const [result2, fulfilled2] = await randomnessProvider.getRandomResult(gameId2);
      const [result3, fulfilled3] = await randomnessProvider.getRandomResult(gameId3);
      
      expect(fulfilled1).to.be.true;
      expect(fulfilled2).to.be.true;
      expect(fulfilled3).to.be.true;
      
      expect(result1).to.equal(randomWords1[0]);
      expect(result2).to.equal(randomWords2[0]);
      expect(result3).to.equal(randomWords3[0]);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle fulfillment for unknown requestId gracefully", async function () {
      const { randomnessProvider, mockVRFCoordinator } = await loadFixture(deployRandomnessProviderFixture);
      
      // Try to fulfill a random request that doesn't exist
      const nonExistentRequestId = 999;
      const randomWords = [ethers.BigNumber.from("12345")];
      
      // This should not revert, but simply do nothing
      await mockVRFCoordinator.fulfillRandomWords(nonExistentRequestId, randomnessProvider.address, randomWords);
      
      // No assertions needed - we're just checking that it doesn't revert
    });

    it("Should handle zero as a valid random number", async function () {
      const { randomnessProvider, mockVRFCoordinator, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      // Mock the VRF Coordinator to return a specific requestId
      const requestId = 123;
      await mockVRFCoordinator.setRequestId(requestId);
      
      // Request randomness
      await randomnessProvider.connect(owner).requestRandomness(gameId);
      
      // Fulfill with zero as the random number
      const randomWords = [ethers.BigNumber.from("0")];
      await mockVRFCoordinator.fulfillRandomWords(requestId, randomnessProvider.address, randomWords);
      
      // Check that the random number was stored correctly
      const [storedRandomNumber, fulfilled] = await randomnessProvider.getRandomResult(gameId);
      expect(storedRandomNumber).to.equal(0);
      expect(fulfilled).to.be.true;
    });
  });

  describe("Ownership Transfer", function () {
    it("Should allow transferring ownership", async function () {
      const { randomnessProvider, owner, user1 } = await loadFixture(deployRandomnessProviderFixture);
      
      // Transfer ownership to user1
      await randomnessProvider.connect(owner).transferOwnership(user1.address);
      
      // Check that user1 is now the owner
      expect(await randomnessProvider.owner()).to.equal(user1.address);
      
      // User1 should now be able to request randomness
      const gameId = ethers.utils.id("game1");
      await expect(randomnessProvider.connect(user1).requestRandomness(gameId)).to.not.be.reverted;
    });

    it("Should prevent the old owner from using owner functions after transfer", async function () {
      const { randomnessProvider, owner, user1 } = await loadFixture(deployRandomnessProviderFixture);
      
      // Transfer ownership to user1
      await randomnessProvider.connect(owner).transferOwnership(user1.address);
      
      // Old owner should not be able to request randomness anymore
      const gameId = ethers.utils.id("game1");
      await expect(
        randomnessProvider.connect(owner).requestRandomness(gameId)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Configuration Updates", function () {
    it("Should allow owner to update callback gas limit", async function () {
      const { randomnessProvider, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      // Update callback gas limit
      const newCallbackGasLimit = 300000;
      await randomnessProvider.connect(owner).setCallbackGasLimit(newCallbackGasLimit);
      
      // Check that the callback gas limit was updated
      expect(await randomnessProvider.callbackGasLimit()).to.equal(newCallbackGasLimit);
    });

    it("Should prevent non-owners from updating callback gas limit", async function () {
      const { randomnessProvider, attacker } = await loadFixture(deployRandomnessProviderFixture);
      
      // Try to update callback gas limit as non-owner
      const newCallbackGasLimit = 300000;
      await expect(
        randomnessProvider.connect(attacker).setCallbackGasLimit(newCallbackGasLimit)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Integration with VRF Coordinator", function () {
    it("Should emit events when requesting and fulfilling randomness", async function () {
      const { randomnessProvider, mockVRFCoordinator, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      // Mock the VRF Coordinator to return a specific requestId
      const requestId = 123;
      await mockVRFCoordinator.setRequestId(requestId);
      
      // Request randomness and check for event
      await expect(randomnessProvider.connect(owner).requestRandomness(gameId))
        .to.emit(randomnessProvider, "RandomnessRequested")
        .withArgs(gameId, requestId);
      
      // Fulfill randomness and check for event
      const randomNumber = ethers.BigNumber.from("12345");
      const randomWords = [randomNumber];
      
      await expect(mockVRFCoordinator.fulfillRandomWords(requestId, randomnessProvider.address, randomWords))
        .to.emit(randomnessProvider, "RandomnessFulfilled")
        .withArgs(gameId, randomNumber);
    });

    it("Should handle multiple random words correctly", async function () {
      const { randomnessProvider, mockVRFCoordinator, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      // Mock the VRF Coordinator to return a specific requestId
      const requestId = 123;
      await mockVRFCoordinator.setRequestId(requestId);
      
      // Request randomness
      await randomnessProvider.connect(owner).requestRandomness(gameId);
      
      // Fulfill with multiple random words (should only use the first one)
      const randomWords = [
        ethers.BigNumber.from("12345"),
        ethers.BigNumber.from("67890"),
        ethers.BigNumber.from("54321")
      ];
      
      await mockVRFCoordinator.fulfillRandomWords(requestId, randomnessProvider.address, randomWords);
      
      // Check that only the first random number was stored
      const [storedRandomNumber, fulfilled] = await randomnessProvider.getRandomResult(gameId);
      expect(storedRandomNumber).to.equal(randomWords[0]);
      expect(fulfilled).to.be.true;
    });
  });
}); 