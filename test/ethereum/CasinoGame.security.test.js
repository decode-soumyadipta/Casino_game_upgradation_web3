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
      
      // Check balances
      const player1Balance = await casinoGame.balanceOf(player1.address);
      const player2Balance = await casinoGame.balanceOf(player2.address);
      
      expect(player1Balance).to.equal(betAmount1.mul(2));
      expect(player2Balance).to.equal(0);
    });
    
    it("Should handle zero withdrawals", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Player tries to withdraw zero balance
      await expect(
        casinoGame.connect(player1).withdraw(0)
      ).to.be.revertedWith("Nothing to withdraw");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency withdrawals by owner", async function () {
      const { casinoGame, owner, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Player places a bet
      const betAmount = ethers.utils.parseEther("0.5");
      await casinoGame.connect(player1).placeBet({ value: betAmount });
      
      // Owner performs emergency withdrawal
      const initialOwnerBalance = await owner.getBalance();
      
      const tx = await casinoGame.emergencyWithdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      const finalOwnerBalance = await owner.getBalance();
      
      // Check that owner received the funds minus gas costs
      expect(finalOwnerBalance).to.be.closeTo(
        initialOwnerBalance.add(betAmount).sub(gasUsed),
        ethers.utils.parseEther("0.001") // Allow for small rounding errors
      );
      
      // Check contract balance is zero
      const contractBalance = await ethers.provider.getBalance(casinoGame.address);
      expect(contractBalance).to.equal(0);
    });
    
    it("Should prevent non-owners from emergency withdrawals", async function () {
      const { casinoGame, player1 } = await loadFixture(deployCasinoGameFixture);
      
      // Player tries to perform emergency withdrawal
      await expect(
        casinoGame.connect(player1).emergencyWithdraw()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});

// Mock contract for testing reentrancy protection
const ReentrancyAttackerArtifact = {
  contractName: "ReentrancyAttacker",
  abi: [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_casinoGame",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "attack",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "deposit",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "stateMutability": "payable",
      "type": "receive"
    }
  ],
  bytecode: "0x608060405234801561001057600080fd5b5060405161045f38038061045f83398101604081905261002f91610054565b600080546001600160a01b0319166001600160a01b0392909216919091179055610084565b60006020828403121561006657600080fd5b81516001600160a01b038116811461007d57600080fd5b9392505050565b6103cc806100936000396000f3fe6080604052600436106100295760003560e01c80632d1a59031461003357806347e7ef241461004857600080fd5b3661002e57005b600080fd5b34801561003f57600080fd5b5061004661005b565b005b6100466100563660046102e9565b6101c9565b6000546040516370a0823160e01b81523060048201526001600160a01b03909116906370a0823190602401602060405180830381865afa1580156100a1573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906100c59190610302565b6000546040516370a0823160e01b81523060048201526001600160a01b03909116906370a0823190602401602060405180830381865afa15801561010b573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061012f9190610302565b10156101c7576000546040516000916001600160a01b03169086908381818185875af1925050503d8060008114610180576040519150601f19603f3d011682016040523d82523d6000602084013e610185565b606091505b50509050806101c5576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600f60248201527f5472616e73666572206661696c6564000000000000000000000000000000000060448201526064015b60405180910390fd5b505b565b60008054604051632e1a7d4d60e01b81526004810183905230926001600160a01b0316906332e1a7d4d90602401600060405180830381600087803b15801561020f57600080fd5b505af1158015610223573d6000803e3d6000fd5b5050505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b600082601f83011261026a57600080fd5b813567ffffffffffffffff8082111561028557610285610229565b604051601f8301601f19908116603f011681019082821181831017156102ad576102ad610229565b816040528381528660208588010111156102c657600080fd5b836020870160208301376000602085830101528094505050505092915050565b6000602082840312156102fb57600080fd5b5035919050565b60006020828403121561031457600080fd5b5051919050565b600181811c9082168061032e57607f821691505b60208210810361034e57634e487b7160e01b600052602260045260246000fd5b50919050565b601f82111561039e57600081815260208120601f850160051c8101602086101561037b5750805b601f850160051c820191505b8181101561039a57828155600101610387565b5050505b505050565b815167ffffffffffffffff8111156103bd576103bd610229565b6103d1816103cb845461031a565b84610354565b602080601f83116001811461040657600084156103ee5750858301515b600019600386901b1c1916600185901b178555610399565b600085815260208120601f198616915b8281101561043557888601518255948401946001909101908401610416565b50858210156104535787850151600019600388901b60f8161c191681555b5050505050600190811b0190555056fea2646970667358221220c5c1e5c9c9c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c164736f6c63430008110033"
};

// Mock contract for RandomnessProvider
const MockRandomnessProviderArtifact = {
  contractName: "MockRandomnessProvider",
  abi: [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "gameId",
          "type": "uint256"
        }
      ],
      "name": "requestRandomness",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "requestId",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "gameId",
          "type": "uint256"
        }
      ],
      "name": "isRandomnessAvailable",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "gameId",
          "type": "uint256"
        }
      ],
      "name": "getRandomNumber",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "gameId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "randomNumber",
          "type": "uint256"
        }
      ],
      "name": "fulfillRandomness",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ],
  bytecode: "0x608060405234801561001057600080fd5b50610328806100206000396000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c80632f47fd8614610051578063dc6cfe10146100815780638866c6bd146100a1578063dc777edb146100c1575b600080fd5b61006b60048036038101906100669190610214565b6100d1565b6040516100789190610250565b60405180910390f35b61008b6100f7565b6040516100989190610250565b60405180910390f35b6100ab610100565b6040516100b89190610250565b60405180910390f35b6100cf60048036038101906100ca9190610214565b610109565b005b600060016000838152602001908152602001600020549050919050565b60006001905090565b6000600190506100fd565b6000808281526020019081526020016000208190555060016001600083815260200190815260200160002081905550600080600083815260200190815260200160002054905050565b600080fd5b6000819050919050565b6101f38161017c565b81146101fe57600080fd5b50565b600081359050610210816101ea565b92915050565b60006020828403121561022a57600080fd5b600061023884828501610201565b91505092915050565b61024a8161017c565b82525050565b60006020820190506102656000830184610241565b9291505056fea2646970667358221220c5c1e5c9c9c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c164736f6c63430008110033"
};

// Deploy the mock contracts before running tests
before(async function() {
  // Deploy ReentrancyAttacker contract
  const ReentrancyAttacker = await ethers.getContractFactory(
    ReentrancyAttackerArtifact.abi,
    ReentrancyAttackerArtifact.bytecode
  );
  
  // Deploy MockRandomnessProvider contract
  const MockRandomnessProvider = await ethers.getContractFactory(
    MockRandomnessProviderArtifact.abi,
    MockRandomnessProviderArtifact.bytecode
  );
}); 