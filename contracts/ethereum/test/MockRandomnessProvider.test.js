const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockRandomnessProvider", function () {
  let mockRandomnessProvider;
  let owner;
  let addr1;
  let addr2;
  
  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();
    
    // Deploy MockRandomnessProvider
    const MockRandomnessProvider = await ethers.getContractFactory("MockRandomnessProvider");
    mockRandomnessProvider = await MockRandomnessProvider.deploy();
  });
  
  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await mockRandomnessProvider.owner()).to.equal(owner.address);
    });
  });
  
  describe("Mock Randomness", function () {
    it("Should return the default mock random value", async function () {
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("game1"));
      
      // Request randomness
      await mockRandomnessProvider.requestRandomness(gameId);
      
      // Check if randomness is fulfilled
      expect(await mockRandomnessProvider.isRandomnessFulfilled(gameId)).to.be.true;
      
      // Check random result
      const result = await mockRandomnessProvider.getRandomResult(gameId);
      expect(result[0]).to.equal(12345); // Default mock value
      expect(result[1]).to.be.true;
    });
    
    it("Should allow setting a custom mock random value", async function () {
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("game1"));
      const customValue = 54321;
      
      // Set custom mock value
      await mockRandomnessProvider.setMockRandomValue(customValue);
      
      // Request randomness
      await mockRandomnessProvider.requestRandomness(gameId);
      
      // Check random result
      const result = await mockRandomnessProvider.getRandomResult(gameId);
      expect(result[0]).to.equal(customValue);
      expect(result[1]).to.be.true;
    });
    
    it("Should emit events when requesting randomness", async function () {
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("game1"));
      
      // Request randomness and check events
      await expect(mockRandomnessProvider.requestRandomness(gameId))
        .to.emit(mockRandomnessProvider, "RandomnessRequested")
        .withArgs(gameId, 0) // Mock request ID is 0
        .to.emit(mockRandomnessProvider, "RandomnessFulfilled")
        .withArgs(gameId, 12345); // Default mock value
    });
    
    it("Should not allow requesting randomness for the same game twice", async function () {
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("game1"));
      
      // First request should succeed
      await mockRandomnessProvider.requestRandomness(gameId);
      
      // Second request should fail
      await expect(mockRandomnessProvider.requestRandomness(gameId))
        .to.be.revertedWith("Randomness already requested for this game");
    });
    
    it("Should only allow owner to request randomness", async function () {
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("game1"));
      
      await expect(mockRandomnessProvider.connect(addr1).requestRandomness(gameId))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
}); 