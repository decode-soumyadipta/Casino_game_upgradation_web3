const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RandomnessProvider", function () {
  let randomnessProvider;
  let owner;
  let addr1;
  let addr2;
  
  // Mock VRF Coordinator for testing
  let mockVrfCoordinator;
  
  // Test parameters
  const subscriptionId = 1;
  const keyHash = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
  const callbackGasLimit = 100000;
  
  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();
    
    // Deploy mock VRF Coordinator
    const MockVRFCoordinatorV2 = await ethers.getContractFactory("MockVRFCoordinatorV2");
    mockVrfCoordinator = await MockVRFCoordinatorV2.deploy();
    
    // Deploy RandomnessProvider
    const RandomnessProvider = await ethers.getContractFactory("RandomnessProvider");
    randomnessProvider = await RandomnessProvider.deploy(
      await mockVrfCoordinator.getAddress(),
      subscriptionId,
      keyHash,
      callbackGasLimit
    );
  });
  
  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await randomnessProvider.owner()).to.equal(owner.address);
    });
  });
  
  describe("Randomness Request", function () {
    it("Should request randomness and emit event", async function () {
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("game1"));
      
      await expect(randomnessProvider.requestRandomness(gameId))
        .to.emit(randomnessProvider, "RandomnessRequested")
        .withArgs(gameId, 1); // First request ID is 1
    });
    
    it("Should not allow requesting randomness for the same game twice", async function () {
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("game1"));
      
      // First request should succeed
      await randomnessProvider.requestRandomness(gameId);
      
      // Mock fulfillment
      await mockVrfCoordinator.fulfillRandomWords(1, await randomnessProvider.getAddress(), [12345]);
      
      // Second request should fail
      await expect(randomnessProvider.requestRandomness(gameId))
        .to.be.revertedWith("Randomness already requested for this game");
    });
    
    it("Should only allow owner to request randomness", async function () {
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("game1"));
      
      await expect(randomnessProvider.connect(addr1).requestRandomness(gameId))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  
  describe("Randomness Fulfillment", function () {
    it("Should fulfill randomness and emit event", async function () {
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("game1"));
      const randomNumber = 12345;
      
      // Request randomness
      await randomnessProvider.requestRandomness(gameId);
      
      // Fulfill randomness
      await expect(mockVrfCoordinator.fulfillRandomWords(1, await randomnessProvider.getAddress(), [randomNumber]))
        .to.emit(randomnessProvider, "RandomnessFulfilled")
        .withArgs(gameId, randomNumber);
      
      // Check if randomness is fulfilled
      expect(await randomnessProvider.isRandomnessFulfilled(gameId)).to.be.true;
      
      // Check random result
      const result = await randomnessProvider.getRandomResult(gameId);
      expect(result[0]).to.equal(randomNumber);
      expect(result[1]).to.be.true;
    });
  });
}); 