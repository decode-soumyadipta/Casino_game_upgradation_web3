const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CasinoGame", function () {
  let casinoGame;
  let owner;
  let addr1;
  let addr2;
  
  const houseEdge = 500; // 5%
  const minBet = ethers.parseEther("0.01");
  const maxBet = ethers.parseEther("1");
  
  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();
    
    // Deploy CasinoGame with correct constructor parameters
    const CasinoGame = await ethers.getContractFactory("CasinoGame");
    casinoGame = await CasinoGame.deploy(houseEdge, minBet, maxBet);
  });
  
  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await casinoGame.owner()).to.equal(owner.address);
    });
    
    it("Should set the correct house edge", async function () {
      expect(await casinoGame.houseEdge()).to.equal(houseEdge);
    });
    
    it("Should set the correct bet limits", async function () {
      expect(await casinoGame.minBet()).to.equal(minBet);
      expect(await casinoGame.maxBet()).to.equal(maxBet);
    });
  });
  
  describe("Deposits and Withdrawals", function () {
    it("Should allow deposits", async function () {
      const depositAmount = ethers.parseEther("0.5");
      
      await expect(casinoGame.connect(addr1).deposit({ value: depositAmount }))
        .to.emit(casinoGame, "Deposit")
        .withArgs(addr1.address, depositAmount);
      
      expect(await casinoGame.balanceOf(addr1.address)).to.equal(depositAmount);
    });
    
    it("Should allow withdrawals", async function () {
      const depositAmount = ethers.parseEther("0.5");
      const withdrawAmount = ethers.parseEther("0.2");
      
      // First deposit
      await casinoGame.connect(addr1).deposit({ value: depositAmount });
      
      // Then withdraw
      await expect(casinoGame.connect(addr1).withdraw(withdrawAmount))
        .to.emit(casinoGame, "Withdrawal")
        .withArgs(addr1.address, withdrawAmount);
      
      expect(await casinoGame.balanceOf(addr1.address)).to.equal(depositAmount - withdrawAmount);
    });
    
    it("Should not allow withdrawing more than balance", async function () {
      const depositAmount = ethers.parseEther("0.5");
      const withdrawAmount = ethers.parseEther("0.6");
      
      // First deposit
      await casinoGame.connect(addr1).deposit({ value: depositAmount });
      
      // Then try to withdraw more
      await expect(casinoGame.connect(addr1).withdraw(withdrawAmount))
        .to.be.revertedWith("Insufficient balance");
    });
  });
  
  describe("Emergency Functions", function () {
    it("Should allow owner to pause the contract", async function () {
      await casinoGame.pause();
      expect(await casinoGame.paused()).to.be.true;
    });
    
    it("Should allow owner to unpause the contract", async function () {
      await casinoGame.pause();
      await casinoGame.unpause();
      expect(await casinoGame.paused()).to.be.false;
    });
    
    it("Should not allow non-owner to pause the contract", async function () {
      await expect(casinoGame.connect(addr1).pause())
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("Should allow owner to withdraw funds in emergency", async function () {
      const depositAmount = ethers.parseEther("1");
      
      // First deposit some funds
      await casinoGame.connect(addr1).deposit({ value: depositAmount });
      
      // Owner withdraws in emergency
      const initialBalance = await ethers.provider.getBalance(owner.address);
      await casinoGame.emergencyWithdraw(depositAmount);
      const finalBalance = await ethers.provider.getBalance(owner.address);
      
      // Check that owner received the funds (minus gas costs)
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });
}); 