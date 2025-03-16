// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../CasinoGame.sol";

/**
 * @title ReentrancyAttacker
 * @dev Contract to test reentrancy protection in the CasinoGame contract
 */
contract ReentrancyAttacker {
    CasinoGame private casinoGame;
    bool private attacking = false;
    
    /**
     * @dev Constructor
     * @param _casinoGame Address of the CasinoGame contract to attack
     */
    constructor(address _casinoGame) {
        casinoGame = CasinoGame(_casinoGame);
    }
    
    /**
     * @dev Deposit funds to the casino
     */
    function deposit() external payable {
        casinoGame.deposit{value: msg.value}();
    }
    
    /**
     * @dev Attempt a reentrancy attack
     */
    function attack() external {
        attacking = true;
        casinoGame.withdraw();
    }
    
    /**
     * @dev Fallback function that attempts to withdraw again
     */
    receive() external payable {
        if (attacking) {
            attacking = false;
            casinoGame.withdraw();
        }
    }
} 