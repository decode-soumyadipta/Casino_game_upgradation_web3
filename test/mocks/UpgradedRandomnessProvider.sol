// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UpgradedRandomnessProvider
 * @dev An upgraded version of the RandomnessProvider with improved randomness generation
 */
contract UpgradedRandomnessProvider is Ownable {
    address public casinoGameAddress;
    mapping(uint256 => uint256) private randomNumbers;
    mapping(uint256 => bool) private hasRandom;
    
    // New variables for improved randomness
    uint256 private nonce;
    bytes32 private lastBlockHash;

    event RandomnessRequested(uint256 indexed gameId);
    event RandomnessGenerated(uint256 indexed gameId, uint256 randomNumber);
    event RandomnessMethodUpgraded(string method);

    constructor() {
        nonce = 0;
        lastBlockHash = blockhash(block.number - 1);
        emit RandomnessMethodUpgraded("Enhanced blockhash with nonce");
    }

    /**
     * @dev Sets the casino game address
     * @param _casinoGameAddress The address of the casino game contract
     */
    function setCasinoGameAddress(address _casinoGameAddress) external onlyOwner {
        casinoGameAddress = _casinoGameAddress;
    }

    /**
     * @dev Requests randomness for a game with improved algorithm
     * @param gameId The ID of the game
     */
    function requestRandomness(uint256 gameId) external {
        require(msg.sender == casinoGameAddress, "Only authorized casino game can request randomness");
        
        // Update the last block hash
        lastBlockHash = blockhash(block.number - 1);
        
        // Generate a random number using multiple sources of entropy
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(
            lastBlockHash,
            block.timestamp,
            msg.sender,
            nonce,
            gameId
        )));
        
        // Update nonce for next request
        nonce++;
        
        // Store the random number
        randomNumbers[gameId] = randomNumber;
        hasRandom[gameId] = true;
        
        emit RandomnessRequested(gameId);
        emit RandomnessGenerated(gameId, randomNumber);
    }

    /**
     * @dev Gets the random number for a game
     * @param gameId The ID of the game
     * @return The random number
     */
    function getRandomNumber(uint256 gameId) external view returns (uint256) {
        require(hasRandom[gameId], "No random number generated for this game ID");
        return randomNumbers[gameId];
    }

    /**
     * @dev Checks if a random number has been generated for a game
     * @param gameId The ID of the game
     * @return Whether a random number has been generated
     */
    function hasRandomNumber(uint256 gameId) external view returns (bool) {
        return hasRandom[gameId];
    }

    /**
     * @dev Gets the current nonce value
     * @return The current nonce
     */
    function getCurrentNonce() external view returns (uint256) {
        return nonce;
    }

    /**
     * @dev Gets the last block hash used for randomness
     * @return The last block hash
     */
    function getLastBlockHash() external view returns (bytes32) {
        return lastBlockHash;
    }
} 