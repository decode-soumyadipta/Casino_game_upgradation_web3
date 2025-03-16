// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockRandomnessProvider
 * @dev A mock implementation of the RandomnessProvider for testing purposes
 */
contract MockRandomnessProvider is Ownable {
    address public casinoGameAddress;
    mapping(uint256 => uint256) private randomNumbers;
    mapping(uint256 => bool) private hasRandom;
    uint256 private mockRandomValue = 12345;

    event RandomnessRequested(uint256 indexed gameId);
    event RandomnessGenerated(uint256 indexed gameId, uint256 randomNumber);

    /**
     * @dev Sets the casino game address
     * @param _casinoGameAddress The address of the casino game contract
     */
    function setCasinoGameAddress(address _casinoGameAddress) external onlyOwner {
        casinoGameAddress = _casinoGameAddress;
    }

    /**
     * @dev Sets a specific mock random value to be returned
     * @param _mockValue The mock random value to use
     */
    function setMockRandomValue(uint256 _mockValue) external {
        mockRandomValue = _mockValue;
    }

    /**
     * @dev Requests randomness for a game
     * @param gameId The ID of the game
     */
    function requestRandomness(uint256 gameId) external {
        require(msg.sender == casinoGameAddress, "Only authorized casino game can request randomness");
        
        // Generate a deterministic but different random number for each game ID
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(gameId, mockRandomValue, block.timestamp)));
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
} 