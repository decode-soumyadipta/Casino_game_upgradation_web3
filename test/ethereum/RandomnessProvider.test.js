const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Mock for VRFCoordinatorV2
const mockVrfCoordinatorFactory = async () => {
  const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinator");
  return await MockVRFCoordinator.deploy();
};

describe("RandomnessProvider Contract", function () {
  // We need to deploy a mock VRF Coordinator for testing
  async function deployMockVRFCoordinator() {
    const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinator");
    const mockVRFCoordinator = await MockVRFCoordinator.deploy();
    return mockVRFCoordinator;
  }

  // We define a fixture to reuse the same setup in every test
  async function deployRandomnessProviderFixture() {
    // Get signers
    const [owner, user] = await ethers.getSigners();

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
    
    return { randomnessProvider, mockVRFCoordinator, owner, user, subscriptionId, keyHash, callbackGasLimit };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { randomnessProvider, owner } = await loadFixture(deployRandomnessProviderFixture);
      expect(await randomnessProvider.owner()).to.equal(owner.address);
    });
  });

  describe("Randomness Request", function () {
    it("Should allow owner to request randomness", async function () {
      const { randomnessProvider, mockVRFCoordinator, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      // Mock the VRF Coordinator to return a specific requestId
      const requestId = 123;
      await mockVRFCoordinator.setRequestId(requestId);
      
      // Request randomness
      await expect(randomnessProvider.connect(owner).requestRandomness(gameId))
        .to.emit(randomnessProvider, "RandomnessRequested")
        .withArgs(gameId, requestId);
    });

    it("Should not allow non-owner to request randomness", async function () {
      const { randomnessProvider, user } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      await expect(
        randomnessProvider.connect(user).requestRandomness(gameId)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow requesting randomness twice for the same game", async function () {
      const { randomnessProvider, mockVRFCoordinator, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      // Mock the VRF Coordinator to return a specific requestId
      const requestId = 123;
      await mockVRFCoordinator.setRequestId(requestId);
      
      // Request randomness first time
      await randomnessProvider.connect(owner).requestRandomness(gameId);
      
      // Fulfill the randomness request
      const randomWords = [ethers.BigNumber.from("12345")];
      await mockVRFCoordinator.fulfillRandomWords(requestId, randomnessProvider.address, randomWords);
      
      // Try to request randomness again for the same game
      await expect(
        randomnessProvider.connect(owner).requestRandomness(gameId)
      ).to.be.revertedWith("Randomness already requested for this game");
    });
  });

  describe("Randomness Fulfillment", function () {
    it("Should correctly store random number when fulfilled", async function () {
      const { randomnessProvider, mockVRFCoordinator, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      // Mock the VRF Coordinator to return a specific requestId
      const requestId = 123;
      await mockVRFCoordinator.setRequestId(requestId);
      
      // Request randomness
      await randomnessProvider.connect(owner).requestRandomness(gameId);
      
      // Fulfill the randomness request
      const randomNumber = ethers.BigNumber.from("12345");
      const randomWords = [randomNumber];
      
      await expect(mockVRFCoordinator.fulfillRandomWords(requestId, randomnessProvider.address, randomWords))
        .to.emit(randomnessProvider, "RandomnessFulfilled")
        .withArgs(gameId, randomNumber);
      
      // Check that the random number was stored correctly
      const [storedRandomNumber, fulfilled] = await randomnessProvider.getRandomResult(gameId);
      expect(storedRandomNumber).to.equal(randomNumber);
      expect(fulfilled).to.be.true;
    });

    it("Should correctly report fulfillment status", async function () {
      const { randomnessProvider, mockVRFCoordinator, owner } = await loadFixture(deployRandomnessProviderFixture);
      
      const gameId = ethers.utils.id("game1");
      
      // Check that the game is not fulfilled initially
      expect(await randomnessProvider.isRandomnessFulfilled(gameId)).to.be.false;
      
      // Mock the VRF Coordinator to return a specific requestId
      const requestId = 123;
      await mockVRFCoordinator.setRequestId(requestId);
      
      // Request randomness
      await randomnessProvider.connect(owner).requestRandomness(gameId);
      
      // Check that the game is still not fulfilled after request
      expect(await randomnessProvider.isRandomnessFulfilled(gameId)).to.be.false;
      
      // Fulfill the randomness request
      const randomNumber = ethers.BigNumber.from("12345");
      const randomWords = [randomNumber];
      await mockVRFCoordinator.fulfillRandomWords(requestId, randomnessProvider.address, randomWords);
      
      // Check that the game is now fulfilled
      expect(await randomnessProvider.isRandomnessFulfilled(gameId)).to.be.true;
    });
  });

  describe("Ownership", function () {
    it("Should allow transferring ownership", async function () {
      const { randomnessProvider, owner, user } = await loadFixture(deployRandomnessProviderFixture);
      
      // Transfer ownership to user
      await randomnessProvider.connect(owner).transferOwnership(user.address);
      
      // Check that user is now the owner
      expect(await randomnessProvider.owner()).to.equal(user.address);
      
      // User should now be able to request randomness
      const gameId = ethers.utils.id("game1");
      await expect(randomnessProvider.connect(user).requestRandomness(gameId)).to.not.be.reverted;
    });
  });
}); 