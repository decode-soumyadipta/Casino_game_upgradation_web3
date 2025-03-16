const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CasinoGame Contract", function () {
  // Deploy the CasinoGame contract with a mock RandomnessProvider
  async function deployCasinoGameFixture() {
    // Get signers
    const [owner, player1, player2, attacker] = await ethers.getSigners();

    // Deploy mock RandomnessProvider
    const MockRandomnessProvider = await ethers.getContractFactory("MockRandomnessProvider");
    const randomnessProvider = await MockRandomnessProvider.deploy();

    // Deploy CasinoGame
    const CasinoGame = await ethers.getContractFactory("MockCasinoGame");
    const casinoGame = await CasinoGame.deploy(await randomnessProvider.getAddress());

    // Set house edge and bet limits
    const houseEdgeBasisPoints = 250; // 2.5%
    const minBet = ethers.parseEther("0.01");
    const maxBet = ethers.parseEther("1");

    await casinoGame.setHouseEdge(houseEdgeBasisPoints);
    await casinoGame.setBetLimits(minBet, maxBet);

    return { 
      casinoGame, 
      randomnessProvider, 
      owner, 
      player1, 
      player2, 
      attacker, 
      houseEdgeBasisPoints, 
      minBet, 
      maxBet 
    };
  }

  // Deploy a reentrancy attacker contract
  async function deployReentrancyAttackerFixture() {
    const { casinoGame, randomnessProvider, owner, player1, player2, attacker } = 
      await loadFixture(deployCasinoGameFixture);
    
    // Deploy the ReentrancyAttacker contract
    const ReentrancyAttacker = await ethers.getContractFactory("ReentrancyAttacker");
    const reentrancyAttacker = await ReentrancyAttacker.connect(attacker).deploy(
      await casinoGame.getAddress()
    );
    
    return { 
      casinoGame, 
      randomnessProvider, 
      owner, 
      player1, 
      player2, 
      attacker, 
      reentrancyAttacker 
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { casinoGame, owner } = await loadFixture(deployCasinoGameFixture);
      expect(await casinoGame.owner()).to.equal(owner.address);
    });

    it("Should set the correct initial values", async function () {
      const { casinoGame, houseEdgeBasisPoints, minBet, maxBet } = 
        await loadFixture(deployCasinoGameFixture);
      
      expect(await casinoGame.houseEdge()).to.equal(houseEdgeBasisPoints);
      expect(await casinoGame.minBet()).to.equal(minBet);
      expect(await casinoGame.maxBet()).to.equal(maxBet);
    });
  });

  describe("Betting Functionality", function () {
    it("Should allow players to place bets within limits", async function () {
      const { casinoGame, player1, minBet } = await loadFixture(deployCasinoGameFixture);
      
      const betAmount = minBet + ethers.parseEther("0.01");
      await expect(casinoGame.connect(player1).placeBet({ value: betAmount }))
        .to.not.be.reverted;
      
      // Verify the bet was recorded
      const gameId = 1; // First game should have ID 1
      const game = await casinoGame.getGame(gameId);
      expect(game.player).to.equal(player1.address);
      expect(game.betAmount).to.equal(betAmount);
      expect(game.isSettled).to.be.false;
    });

    it("Should reject bets below minimum", async function () {
      const { casinoGame, player1, minBet } = await loadFixture(deployCasinoGameFixture);
      
      const betAmount = minBet - 1n;
      await expect(casinoGame.connect(player1).placeBet({ value: betAmount }))
        .to.be.revertedWith("Bet below minimum");
    });

    it("Should reject bets above maximum", async function () {
      const { casinoGame, player1, maxBet } = await loadFixture(deployCasinoGameFixture);
      
      const betAmount = maxBet + 1n;
      await expect(casinoGame.connect(player1).placeBet({ value: betAmount }))
        .to.be.revertedWith("Bet above maximum");
    });
  });

  describe("Game Settlement", function () {
    it("Should allow owner to settle games", async function () {
      const { casinoGame, player1, minBet } = await loadFixture(deployCasinoGameFixture);
      
      // Place a bet
      const betAmount = minBet + ethers.parseEther("0.01");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      
      // Settle the game as a win
      const gameId = 1;
      const winAmount = betAmount * 2n;
      await expect(casinoGame.settleGame(gameId, true, winAmount))
        .to.not.be.reverted;
      
      // Verify the game was settled correctly
      const game = await casinoGame.getGame(gameId);
      expect(game.isSettled).to.be.true;
      expect(game.isWin).to.be.true;
      expect(game.winAmount).to.equal(winAmount);
      
      // Verify player balance was updated
      expect(await casinoGame.balanceOf(player1.address)).to.equal(winAmount);
    });

    it("Should prevent non-owners from settling games", async function () {
      const { casinoGame, player1, player2, minBet } = await loadFixture(deployCasinoGameFixture);
      
      // Place a bet
      const betAmount = minBet + ethers.parseEther("0.01");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      
      // Try to settle the game as non-owner
      const gameId = 1;
      const winAmount = betAmount * 2n;
      await expect(casinoGame.connect(player2).settleGame(gameId, true, winAmount))
        .to.be.reverted; // The exact error message may vary
    });
  });

  describe("Withdrawal Functionality", function () {
    it("Should allow players to withdraw their winnings", async function () {
      const { casinoGame, player1, minBet } = await loadFixture(deployCasinoGameFixture);
      
      // Place a bet
      const betAmount = minBet + ethers.parseEther("0.01");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      
      // Settle the game as a win
      const gameId = 1;
      const winAmount = betAmount * 2n;
      await casinoGame.settleGame(gameId, true, winAmount);
      
      // Get player's balance before withdrawal
      const balanceBefore = await ethers.provider.getBalance(player1.address);
      
      // Withdraw winnings
      const tx = await casinoGame.connect(player1).withdraw(winAmount);
      const receipt = await tx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      // Get player's balance after withdrawal
      const balanceAfter = await ethers.provider.getBalance(player1.address);
      
      // Verify balance increased by winAmount minus gas costs
      expect(balanceAfter).to.be.closeTo(
        balanceBefore + winAmount - gasUsed,
        ethers.parseEther("0.0001") // Allow for small rounding errors
      );
      
      // Verify casino balance was updated
      expect(await casinoGame.balanceOf(player1.address)).to.equal(0);
    });

    it("Should prevent withdrawals exceeding balance", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Try to withdraw without any balance
      await expect(casinoGame.connect(player1).withdraw(ethers.parseEther("1")))
        .to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks on withdrawals", async function () {
      const { casinoGame, reentrancyAttacker, attacker } = 
        await loadFixture(deployReentrancyAttackerFixture);
      
      // Fund the attacker contract
      await attacker.sendTransaction({
        to: await reentrancyAttacker.getAddress(),
        value: ethers.parseEther("2")
      });
      
      // Attacker deposits funds to the casino
      await reentrancyAttacker.deposit({ value: ethers.parseEther("1") });
      
      // Attempt the reentrancy attack
      await expect(reentrancyAttacker.attack())
        .to.be.reverted;
      
      // Verify that only the legitimate withdrawal went through
      const attackerBalance = await casinoGame.balanceOf(await reentrancyAttacker.getAddress());
      expect(attackerBalance).to.equal(0);
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow owner to pause and unpause", async function () {
      const { casinoGame, owner } = await loadFixture(deployCasinoGameFixture);
      
      // Pause the contract
      await casinoGame.connect(owner).pause();
      expect(await casinoGame.paused()).to.be.true;
      
      // Unpause the contract
      await casinoGame.connect(owner).unpause();
      expect(await casinoGame.paused()).to.be.false;
    });

    it("Should prevent operations when paused", async function () {
      const { casinoGame, owner, player1, minBet } = await loadFixture(deployCasinoGameFixture);
      
      // Pause the contract
      await casinoGame.connect(owner).pause();
      
      // Try to place a bet while paused
      const betAmount = minBet + ethers.parseEther("0.01");
      await expect(casinoGame.connect(player1).placeBet({ value: betAmount }))
        .to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to withdraw house funds in emergency", async function () {
      const { casinoGame, owner, player1, minBet } = await loadFixture(deployCasinoGameFixture);
      
      // Player places a bet and loses
      const betAmount = minBet + ethers.parseEther("0.01");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      await casinoGame.settleGame(1, false, 0);
      
      // Check contract balance
      const contractBalance = await ethers.provider.getBalance(await casinoGame.getAddress());
      expect(contractBalance).to.equal(betAmount);
      
      // Owner withdraws funds
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await casinoGame.connect(owner).emergencyWithdraw(betAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      
      // Account for gas costs
      expect(ownerBalanceAfter).to.be.closeTo(
        ownerBalanceBefore + betAmount - gasUsed,
        ethers.parseEther("0.0001")
      );
      
      // Contract balance should be zero
      const contractBalanceAfter = await ethers.provider.getBalance(await casinoGame.getAddress());
      expect(contractBalanceAfter).to.equal(0);
    });
  });

  describe("Time-based Scenarios", function () {
    it("Should handle games played across time periods", async function () {
      const { casinoGame, player1, minBet } = await loadFixture(deployCasinoGameFixture);
      
      // Place a bet
      const betAmount = minBet + ethers.parseEther("0.01");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      
      // Advance time by 1 day
      await time.increase(86400);
      
      // Place another bet
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      
      // Settle games
      await casinoGame.settleGame(1, true, betAmount * 2n);
      await casinoGame.settleGame(2, true, betAmount * 2n);
      
      // Verify player balance
      expect(await casinoGame.balanceOf(player1.address)).to.equal(betAmount * 4n);
    });
  });

  describe("Gas Optimization", function () {
    it("Should use reasonable gas for operations", async function () {
      const { casinoGame, player1, minBet } = await loadFixture(deployCasinoGameFixture);
      
      // Measure gas for placing a bet
      const betAmount = minBet + ethers.parseEther("0.01");
      const tx = await casinoGame.connect(player1).placeBet({ value: betAmount });
      const receipt = await tx.wait();
      
      console.log(`Gas used for placeBet: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lessThan(200000n); // Reasonable gas limit
    });
  });
}); 