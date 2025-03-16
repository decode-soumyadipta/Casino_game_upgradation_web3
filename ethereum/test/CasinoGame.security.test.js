const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CasinoGame Security Tests", function () {
  // Deploy the CasinoGame contract with a mock RandomnessProvider
  async function deployCasinoGameFixture() {
    const [owner, player1, player2, attacker] = await ethers.getSigners();

    // Deploy mock RandomnessProvider
    const MockRandomnessProvider = await ethers.getContractFactory("MockRandomnessProvider");
    const randomnessProvider = await MockRandomnessProvider.deploy();
    await randomnessProvider.deployed();

    // Deploy CasinoGame
    const CasinoGame = await ethers.getContractFactory("CasinoGame");
    const casinoGame = await CasinoGame.deploy(randomnessProvider.address);
    await casinoGame.deployed();

    // Set house edge and bet limits
    const houseEdgeBasisPoints = 250; // 2.5%
    const minBet = ethers.utils.parseEther("0.01");
    const maxBet = ethers.utils.parseEther("1");

    await casinoGame.setHouseEdge(houseEdgeBasisPoints);
    await casinoGame.setBetLimits(minBet, maxBet);

    return { casinoGame, randomnessProvider, owner, player1, player2, attacker, houseEdgeBasisPoints, minBet, maxBet };
  }

  // Deploy a reentrancy attacker contract
  async function deployReentrancyAttackerFixture() {
    const { casinoGame, randomnessProvider, owner, player1, player2, attacker } = await loadFixture(deployCasinoGameFixture);
    
    // Deploy the ReentrancyAttacker contract
    const ReentrancyAttacker = await ethers.getContractFactory("ReentrancyAttacker");
    const reentrancyAttacker = await ReentrancyAttacker.connect(attacker).deploy(casinoGame.address);
    await reentrancyAttacker.deployed();
    
    return { casinoGame, randomnessProvider, owner, player1, player2, attacker, reentrancyAttacker };
  }

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks on withdrawals", async function () {
      const { casinoGame, reentrancyAttacker, attacker } = await loadFixture(deployReentrancyAttackerFixture);
      
      // Fund the attacker contract
      await attacker.sendTransaction({
        to: reentrancyAttacker.address,
        value: ethers.utils.parseEther("2")
      });
      
      // Attacker deposits funds to the casino
      await reentrancyAttacker.deposit({ value: ethers.utils.parseEther("1") });
      
      // Attempt the reentrancy attack
      await expect(
        reentrancyAttacker.attack()
      ).to.be.reverted;
      
      // Verify that only the legitimate withdrawal went through
      const attackerBalance = await casinoGame.balanceOf(reentrancyAttacker.address);
      expect(attackerBalance).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should prevent non-owners from accessing admin functions", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Try to set house edge as non-owner
      await expect(
        casinoGame.connect(player1).setHouseEdge(300)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to set bet limits as non-owner
      await expect(
        casinoGame.connect(player1).setBetLimits(
          ethers.utils.parseEther("0.1"),
          ethers.utils.parseEther("2")
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to withdraw funds as non-owner
      await expect(
        casinoGame.connect(player1).withdrawHouseFunds(
          player1.address,
          ethers.utils.parseEther("1")
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("Should prevent unauthorized users from settling games", async function () {
      const { casinoGame, randomnessProvider, player1, player2 } = await loadFixture(deployCasinoGameFixture);
      
      // Player1 places a bet
      const betAmount = ethers.utils.parseEther("0.1");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      
      // Get the game ID
      const gameId = 1; // Assuming first game has ID 1
      
      // Player2 tries to settle the game
      await expect(
        casinoGame.connect(player2).settleGame(gameId, true, betAmount.mul(2))
      ).to.be.revertedWith("Only owner or randomness provider can settle games");
    });
  });

  describe("Input Validation", function () {
    it("Should enforce house edge limits", async function () {
      const { casinoGame, owner } = await loadFixture(deployCasinoGameFixture);
      
      // Try to set house edge too high (>10%)
      await expect(
        casinoGame.setHouseEdge(1001) // 10.01%
      ).to.be.revertedWith("House edge cannot exceed 10%");
      
      // Set valid house edge
      await casinoGame.setHouseEdge(500); // 5%
      const houseEdge = await casinoGame.houseEdgeBasisPoints();
      expect(houseEdge).to.equal(500);
    });
    
    it("Should enforce bet limits", async function () {
      const { casinoGame, player1, minBet, maxBet } = await loadFixture(deployCasinoGameFixture);
      
      // Try to bet below minimum
      await expect(
        casinoGame.connect(player1).placeBet({ 
          value: minBet.sub(1) 
        })
      ).to.be.revertedWith("Bet amount outside allowed limits");
      
      // Try to bet above maximum
      await expect(
        casinoGame.connect(player1).placeBet({ 
          value: maxBet.add(1) 
        })
      ).to.be.revertedWith("Bet amount outside allowed limits");
      
      // Place valid bet
      await expect(
        casinoGame.connect(player1).placeBet({ 
          value: minBet.add(ethers.utils.parseEther("0.01")) 
        })
      ).to.not.be.reverted;
    });
    
    it("Should validate win amounts", async function () {
      const { casinoGame, randomnessProvider, player1, houseEdgeBasisPoints } = await loadFixture(deployCasinoGameFixture);
      
      // Player places a bet
      const betAmount = ethers.utils.parseEther("0.1");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      
      // Get the game ID
      const gameId = 1; // Assuming first game has ID 1
      
      // Calculate maximum possible win with house edge
      const basisPoints = 10000;
      const maxPossibleWin = betAmount.mul(basisPoints).div(basisPoints - houseEdgeBasisPoints);
      
      // Try to settle with win amount too high
      await expect(
        casinoGame.settleGame(gameId, true, maxPossibleWin.add(1))
      ).to.be.revertedWith("Win amount exceeds maximum allowed");
      
      // Settle with valid win amount
      await expect(
        casinoGame.settleGame(gameId, true, maxPossibleWin)
      ).to.not.be.reverted;
    });
  });

  describe("Pause Functionality", function () {
    it("Should prevent operations when paused", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Pause the contract
      await casinoGame.pause();
      
      // Try to place a bet while paused
      await expect(
        casinoGame.connect(player1).placeBet({ 
          value: ethers.utils.parseEther("0.1") 
        })
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause the contract
      await casinoGame.unpause();
      
      // Place a bet after unpausing
      await expect(
        casinoGame.connect(player1).placeBet({ 
          value: ethers.utils.parseEther("0.1") 
        })
      ).to.not.be.reverted;
    });
    
    it("Should allow only owner to pause/unpause", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Try to pause as non-owner
      await expect(
        casinoGame.connect(player1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Owner pauses
      await casinoGame.pause();
      
      // Try to unpause as non-owner
      await expect(
        casinoGame.connect(player1).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple games from the same player", async function () {
      const { casinoGame, randomnessProvider, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Player places multiple bets
      const betAmount = ethers.utils.parseEther("0.1");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      
      // Settle games in different order
      await casinoGame.settleGame(2, true, betAmount.mul(2));
      await casinoGame.settleGame(1, false, 0);
      await casinoGame.settleGame(3, true, betAmount.mul(2));
      
      // Check player balance
      const playerBalance = await casinoGame.balanceOf(player1.address);
      expect(playerBalance).to.equal(betAmount.mul(4)); // Initial bets lost + 2 wins
    });
    
    it("Should handle concurrent players correctly", async function () {
      const { casinoGame, randomnessProvider, player1, player2 } = await loadFixture(deployCasinoGameFixture);
      
      // Both players place bets
      const betAmount1 = ethers.utils.parseEther("0.1");
      const betAmount2 = ethers.utils.parseEther("0.2");
      
      await casinoGame.connect(player1).placeBet({ value: betAmount1 });
      await casinoGame.connect(player2).placeBet({ value: betAmount2 });
      
      // Settle games
      await casinoGame.settleGame(1, true, betAmount1.mul(2));
      await casinoGame.settleGame(2, false, 0);
      
      // Check player balances
      const player1Balance = await casinoGame.balanceOf(player1.address);
      const player2Balance = await casinoGame.balanceOf(player2.address);
      
      expect(player1Balance).to.equal(betAmount1.mul(2));
      expect(player2Balance).to.equal(0);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to withdraw house funds in emergency", async function () {
      const { casinoGame, owner, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Player places a bet and loses
      const betAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      await casinoGame.settleGame(1, false, 0);
      
      // Check contract balance
      const contractBalance = await ethers.provider.getBalance(casinoGame.address);
      expect(contractBalance).to.equal(betAmount);
      
      // Owner withdraws funds
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      await casinoGame.withdrawHouseFunds(owner.address, betAmount);
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      
      // Account for gas costs
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
      
      // Contract balance should be zero
      const contractBalanceAfter = await ethers.provider.getBalance(casinoGame.address);
      expect(contractBalanceAfter).to.equal(0);
    });
    
    it("Should prevent non-owners from executing emergency withdrawals", async function () {
      const { casinoGame, player1, player2 } = await loadFixture(deployCasinoGameFixture);
      
      // Player places a bet and loses
      const betAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      await casinoGame.settleGame(1, false, 0);
      
      // Non-owner tries to withdraw funds
      await expect(
        casinoGame.connect(player2).withdrawHouseFunds(player2.address, betAmount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});

// Mock contract for testing reentrancy protection
contract ReentrancyAttacker {
  CasinoGame private casinoGame;
  bool private attacking = false;
  
  constructor(address _casinoGame) {
    casinoGame = CasinoGame(_casinoGame);
  }
  
  // Deposit funds to the casino
  function deposit() external payable {
    casinoGame.deposit{value: msg.value}();
  }
  
  // Attempt a reentrancy attack
  function attack() external {
    attacking = true;
    casinoGame.withdraw();
  }
  
  // Fallback function that attempts to withdraw again
  receive() external payable {
    if (attacking) {
      attacking = false;
      casinoGame.withdraw();
    }
  }
} 