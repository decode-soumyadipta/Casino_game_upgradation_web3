const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CasinoGame Contract", function () {
  // We define a fixture to reuse the same setup in every test
  async function deployCasinoGameFixture() {
    // Get signers
    const [owner, operator, player1, player2] = await ethers.getSigners();

    // Deploy CasinoGame contract
    const houseEdge = 250; // 2.5% in basis points
    const minBet = ethers.utils.parseEther("0.01");
    const maxBet = ethers.utils.parseEther("1");
    
    const CasinoGame = await ethers.getContractFactory("CasinoGame");
    const casinoGame = await CasinoGame.deploy(houseEdge, minBet, maxBet);
    
    return { casinoGame, owner, operator, player1, player2, houseEdge, minBet, maxBet };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { casinoGame, owner } = await loadFixture(deployCasinoGameFixture);
      expect(await casinoGame.owner()).to.equal(owner.address);
    });

    it("Should set the right house edge", async function () {
      const { casinoGame, houseEdge } = await loadFixture(deployCasinoGameFixture);
      expect(await casinoGame.houseEdge()).to.equal(houseEdge);
    });

    it("Should set the right min bet", async function () {
      const { casinoGame, minBet } = await loadFixture(deployCasinoGameFixture);
      expect(await casinoGame.minBet()).to.equal(minBet);
    });

    it("Should set the right max bet", async function () {
      const { casinoGame, maxBet } = await loadFixture(deployCasinoGameFixture);
      expect(await casinoGame.maxBet()).to.equal(maxBet);
    });

    it("Should set the deployer as an operator", async function () {
      const { casinoGame, owner } = await loadFixture(deployCasinoGameFixture);
      expect(await casinoGame.isOperator(owner.address)).to.be.true;
    });
  });

  describe("Operator Management", function () {
    it("Should allow owner to add an operator", async function () {
      const { casinoGame, owner, operator } = await loadFixture(deployCasinoGameFixture);
      
      await casinoGame.connect(owner).addOperator(operator.address);
      expect(await casinoGame.isOperator(operator.address)).to.be.true;
    });

    it("Should allow owner to remove an operator", async function () {
      const { casinoGame, owner, operator } = await loadFixture(deployCasinoGameFixture);
      
      await casinoGame.connect(owner).addOperator(operator.address);
      expect(await casinoGame.isOperator(operator.address)).to.be.true;
      
      await casinoGame.connect(owner).removeOperator(operator.address);
      expect(await casinoGame.isOperator(operator.address)).to.be.false;
    });

    it("Should not allow non-owner to add an operator", async function () {
      const { casinoGame, operator, player1 } = await loadFixture(deployCasinoGameFixture);
      
      await expect(
        casinoGame.connect(player1).addOperator(operator.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow non-owner to remove an operator", async function () {
      const { casinoGame, owner, operator, player1 } = await loadFixture(deployCasinoGameFixture);
      
      await casinoGame.connect(owner).addOperator(operator.address);
      
      await expect(
        casinoGame.connect(player1).removeOperator(operator.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("User Balance Management", function () {
    it("Should allow users to deposit ETH", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      const depositAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      
      expect(await casinoGame.balanceOf(player1.address)).to.equal(depositAmount);
    });

    it("Should allow users to withdraw ETH", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      const depositAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      
      const withdrawAmount = ethers.utils.parseEther("0.2");
      await casinoGame.connect(player1).withdraw(withdrawAmount);
      
      expect(await casinoGame.balanceOf(player1.address)).to.equal(depositAmount.sub(withdrawAmount));
    });

    it("Should not allow users to withdraw more than their balance", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      const depositAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      
      const withdrawAmount = ethers.utils.parseEther("0.6");
      await expect(
        casinoGame.connect(player1).withdraw(withdrawAmount)
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Game Mechanics", function () {
    it("Should allow players to place bets", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Deposit funds
      const depositAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      
      // Place bet
      const gameId = ethers.utils.id("game1");
      const betAmount = ethers.utils.parseEther("0.1");
      
      await casinoGame.connect(player1).placeBet(gameId, betAmount);
      
      // Check player balance was reduced
      expect(await casinoGame.balanceOf(player1.address)).to.equal(depositAmount.sub(betAmount));
      
      // Check game was created
      const game = await casinoGame.getGame(gameId);
      expect(game.player).to.equal(player1.address);
      expect(game.betAmount).to.equal(betAmount);
      expect(game.isSettled).to.be.false;
    });

    it("Should not allow bets below minimum", async function () {
      const { casinoGame, player1, minBet } = await loadFixture(deployCasinoGameFixture);
      
      // Deposit funds
      const depositAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      
      // Place bet below minimum
      const gameId = ethers.utils.id("game1");
      const betAmount = minBet.sub(1);
      
      await expect(
        casinoGame.connect(player1).placeBet(gameId, betAmount)
      ).to.be.revertedWith("Bet below minimum");
    });

    it("Should not allow bets above maximum", async function () {
      const { casinoGame, player1, maxBet } = await loadFixture(deployCasinoGameFixture);
      
      // Deposit funds
      const depositAmount = ethers.utils.parseEther("2");
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      
      // Place bet above maximum
      const gameId = ethers.utils.id("game1");
      const betAmount = maxBet.add(1);
      
      await expect(
        casinoGame.connect(player1).placeBet(gameId, betAmount)
      ).to.be.revertedWith("Bet above maximum");
    });

    it("Should allow operators to settle games", async function () {
      const { casinoGame, owner, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Deposit funds
      const depositAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      
      // Place bet
      const gameId = ethers.utils.id("game1");
      const betAmount = ethers.utils.parseEther("0.1");
      await casinoGame.connect(player1).placeBet(gameId, betAmount);
      
      // Settle game as a win
      const winAmount = ethers.utils.parseEther("0.18"); // Less than max possible win with 2.5% house edge
      const resultHash = ethers.utils.id("result1");
      
      await casinoGame.connect(owner).settleGame(gameId, true, winAmount, resultHash);
      
      // Check game was settled
      const game = await casinoGame.getGame(gameId);
      expect(game.isSettled).to.be.true;
      expect(game.isWin).to.be.true;
      expect(game.winAmount).to.equal(winAmount);
      
      // Check player balance was updated
      expect(await casinoGame.balanceOf(player1.address)).to.equal(
        depositAmount.sub(betAmount).add(winAmount)
      );
    });

    it("Should not allow non-operators to settle games", async function () {
      const { casinoGame, player1, player2 } = await loadFixture(deployCasinoGameFixture);
      
      // Deposit funds
      const depositAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      
      // Place bet
      const gameId = ethers.utils.id("game1");
      const betAmount = ethers.utils.parseEther("0.1");
      await casinoGame.connect(player1).placeBet(gameId, betAmount);
      
      // Try to settle game as non-operator
      const winAmount = ethers.utils.parseEther("0.18");
      const resultHash = ethers.utils.id("result1");
      
      await expect(
        casinoGame.connect(player2).settleGame(gameId, true, winAmount, resultHash)
      ).to.be.revertedWith("Not an operator");
    });

    it("Should enforce house edge on win amounts", async function () {
      const { casinoGame, owner, player1, houseEdge } = await loadFixture(deployCasinoGameFixture);
      
      // Deposit funds
      const depositAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      
      // Place bet
      const gameId = ethers.utils.id("game1");
      const betAmount = ethers.utils.parseEther("0.1");
      await casinoGame.connect(player1).placeBet(gameId, betAmount);
      
      // Calculate maximum possible win with house edge
      const basisPoints = 10000;
      const maxPossibleWin = betAmount.mul(basisPoints).div(basisPoints - houseEdge);
      
      // Try to settle game with win amount too high
      const winAmount = maxPossibleWin.add(1);
      const resultHash = ethers.utils.id("result1");
      
      await expect(
        casinoGame.connect(owner).settleGame(gameId, true, winAmount, resultHash)
      ).to.be.revertedWith("Win amount too high");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update house edge", async function () {
      const { casinoGame, owner } = await loadFixture(deployCasinoGameFixture);
      
      const newHouseEdge = 300; // 3%
      await casinoGame.connect(owner).updateHouseEdge(newHouseEdge);
      
      expect(await casinoGame.houseEdge()).to.equal(newHouseEdge);
    });

    it("Should allow owner to update min bet", async function () {
      const { casinoGame, owner } = await loadFixture(deployCasinoGameFixture);
      
      const newMinBet = ethers.utils.parseEther("0.02");
      await casinoGame.connect(owner).updateMinBet(newMinBet);
      
      expect(await casinoGame.minBet()).to.equal(newMinBet);
    });

    it("Should allow owner to update max bet", async function () {
      const { casinoGame, owner } = await loadFixture(deployCasinoGameFixture);
      
      const newMaxBet = ethers.utils.parseEther("2");
      await casinoGame.connect(owner).updateMaxBet(newMaxBet);
      
      expect(await casinoGame.maxBet()).to.equal(newMaxBet);
    });

    it("Should allow owner to pause and unpause the contract", async function () {
      const { casinoGame, owner, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Pause the contract
      await casinoGame.connect(owner).pause();
      
      // Try to deposit while paused
      const depositAmount = ethers.utils.parseEther("0.5");
      await expect(
        casinoGame.connect(player1).deposit({ value: depositAmount })
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause the contract
      await casinoGame.connect(owner).unpause();
      
      // Deposit should work now
      await casinoGame.connect(player1).deposit({ value: depositAmount });
      expect(await casinoGame.balanceOf(player1.address)).to.equal(depositAmount);
    });

    it("Should allow owner to perform emergency withdrawal", async function () {
      const { casinoGame, owner } = await loadFixture(deployCasinoGameFixture);
      
      // Send ETH directly to the contract
      await owner.sendTransaction({
        to: casinoGame.address,
        value: ethers.utils.parseEther("1")
      });
      
      // Check contract balance
      const contractBalance = await ethers.provider.getBalance(casinoGame.address);
      expect(contractBalance).to.equal(ethers.utils.parseEther("1"));
      
      // Perform emergency withdrawal
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const withdrawAmount = ethers.utils.parseEther("0.5");
      
      const tx = await casinoGame.connect(owner).emergencyWithdraw(withdrawAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      // Check owner balance increased (minus gas costs)
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter).to.be.closeTo(
        ownerBalanceBefore.add(withdrawAmount).sub(gasUsed),
        ethers.utils.parseEther("0.0001") // Allow for small rounding errors
      );
      
      // Check contract balance decreased
      const contractBalanceAfter = await ethers.provider.getBalance(casinoGame.address);
      expect(contractBalanceAfter).to.equal(ethers.utils.parseEther("0.5"));
    });
  });
}); 