const { expect } = require('chai');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Read contract source code
function readContractSource(contractName) {
  const sourcePath = path.join(process.cwd(), 'contracts', 'ethereum', `${contractName}.sol`);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source for ${contractName} not found at ${sourcePath}`);
  }
  return fs.readFileSync(sourcePath, 'utf8');
}

describe("Ethereum Contract Analysis", function () {
  let casinoGameSource;
  let randomnessProviderSource;
  
  before(function() {
    try {
      casinoGameSource = readContractSource('CasinoGame');
      randomnessProviderSource = readContractSource('RandomnessProvider');
      
      console.log("Successfully loaded contract sources");
    } catch (error) {
      console.error("Error reading contract sources:", error);
    }
  });
  
  describe("CasinoGame Contract", function() {
    it("should include reentrancy protection", function() {
      expect(casinoGameSource).to.include("ReentrancyGuard");
      expect(casinoGameSource).to.include("nonReentrant");
    });
    
    it("should include access control", function() {
      expect(casinoGameSource).to.include("Ownable");
      expect(casinoGameSource).to.include("onlyOwner");
    });
    
    it("should include pausable functionality", function() {
      expect(casinoGameSource).to.include("Pausable");
      expect(casinoGameSource).to.include("whenNotPaused");
    });
    
    it("should validate bet limits", function() {
      expect(casinoGameSource).to.include("validBet");
      expect(casinoGameSource).to.include("require(_amount >= minBet");
      expect(casinoGameSource).to.include("require(_amount <= maxBet");
    });
    
    it("should validate house edge", function() {
      expect(casinoGameSource).to.include("MAX_HOUSE_EDGE");
      expect(casinoGameSource).to.include("require(_newHouseEdge <= MAX_HOUSE_EDGE");
    });
    
    it("should have emergency withdrawal functionality", function() {
      expect(casinoGameSource).to.include("emergencyWithdraw");
    });
  });
  
  describe("RandomnessProvider Contract", function() {
    it("should include access control", function() {
      expect(randomnessProviderSource).to.include("Ownable");
      expect(randomnessProviderSource).to.include("onlyOwner");
    });
    
    it("should use Chainlink VRF for randomness", function() {
      expect(randomnessProviderSource).to.include("VRFConsumerBaseV2");
      expect(randomnessProviderSource).to.include("VRFCoordinatorV2Interface");
    });
    
    it("should track random numbers by game ID", function() {
      expect(randomnessProviderSource).to.include("mapping(bytes32 => uint256) private s_results");
    });
    
    it("should emit events for randomness requests", function() {
      expect(randomnessProviderSource).to.include("event RandomnessRequested");
      expect(randomnessProviderSource).to.include("emit RandomnessRequested");
    });
  });
  
  describe("Security Analysis", function() {
    it("should check for common vulnerabilities", function() {
      // Check for tx.origin usage (should use msg.sender instead)
      expect(casinoGameSource).to.not.include("tx.origin");
      expect(randomnessProviderSource).to.not.include("tx.origin");
      
      // Check for proper use of visibility modifiers
      expect(casinoGameSource).to.include("private");
      
      // Check for use of SafeMath
      expect(casinoGameSource).to.include("SafeMath");
      
      // Check for use of block.timestamp (acceptable but worth noting)
      if (casinoGameSource.includes("block.timestamp")) {
        console.log("Note: CasinoGame uses block.timestamp which can be manipulated by miners within a few seconds");
      }
    });
  });
}); 